"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateOrder, type CartItem } from "@/lib/orders";
import { asGrocer } from "@/lib/grocer";

// Returns the non-guest user id, or null if not allowed to persist orders.
async function writerId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.isGuest) return null;
  return session.user.id;
}

const clampQty = (n: unknown) => Math.max(1, Math.min(99, Math.floor(Number(n) || 1)));

// Add one or more products to the user's draft cart (basket buttons). Merges by
// picnicId (summing quantities) and pre-ticks them in the order overview.
export async function addToDraftCart(items: CartItem[]): Promise<void> {
  const userId = await writerId();
  if (!userId || !Array.isArray(items) || items.length === 0) return;

  const [draft, dbUser] = await Promise.all([
    prisma.order.findFirst({ where: { userId, status: "DRAFT" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { grocer: true } }),
  ]);
  const grocer = asGrocer(dbUser?.grocer);
  const current: CartItem[] = (draft?.cartItems as CartItem[] | null) ?? [];
  const byId = new Map(current.map((c) => [c.picnicId, { ...c }]));
  for (const it of items) {
    if (!it?.picnicId) continue;
    const existing = byId.get(it.picnicId);
    if (existing) {
      existing.quantity = clampQty(existing.quantity + clampQty(it.quantity));
    } else {
      byId.set(it.picnicId, {
        picnicId: it.picnicId,
        grocer: it.grocer ?? grocer,
        name: it.name,
        imageId: it.imageId ?? null,
        priceCents: it.priceCents ?? null,
        unitQuantity: it.unitQuantity ?? null,
        quantity: clampQty(it.quantity),
      });
    }
  }
  const cartItems = [...byId.values()];
  // Pre-tick the added products in the order overview.
  const selected = new Set(draft?.selectedProductIds ?? []);
  for (const c of cartItems) selected.add(c.picnicId);
  const selectedProductIds = [...selected];

  if (draft) {
    await prisma.order.update({
      where: { id: draft.id },
      data: { cartItems, selectedProductIds },
    });
  } else {
    await prisma.order.create({
      data: { userId, status: "DRAFT", cartItems, selectedProductIds },
    });
  }
  revalidatePath("/", "layout");
  revalidatePath("/order");
}

// Remove a product previously added to the draft cart.
export async function removeDraftCartItem(picnicId: string): Promise<void> {
  const userId = await writerId();
  if (!userId || !picnicId) return;
  const draft = await prisma.order.findFirst({ where: { userId, status: "DRAFT" } });
  if (!draft) return;
  const current: CartItem[] = (draft.cartItems as CartItem[] | null) ?? [];
  const cartItems = current.filter((c) => c.picnicId !== picnicId);
  const selectedProductIds = draft.selectedProductIds.filter((id) => id !== picnicId);
  await prisma.order.update({
    where: { id: draft.id },
    data: { cartItems, selectedProductIds },
  });
  revalidatePath("/", "layout");
  revalidatePath("/order");
}

// Empty the pending order: delete the user's DRAFT order entirely (basket items,
// recipe/list selection and product picks). A fresh draft is created on demand.
export async function clearDraftOrder(): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  await prisma.order.deleteMany({ where: { userId, status: "DRAFT" } });
  revalidatePath("/", "layout");
  revalidatePath("/order");
}

// Autosave the current product selection onto the user's DRAFT order.
export async function saveOrderSelection(selectedProductIds: string[]): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  await prisma.order.updateMany({
    where: { userId, status: "DRAFT" },
    data: { selectedProductIds },
  });
}

// Autosave per-product quantity overrides ({ picnicId: qty }) onto the DRAFT.
export async function saveOrderQuantities(
  quantities: Record<string, number>,
): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const clamped: Record<string, number> = {};
  for (const [id, q] of Object.entries(quantities ?? {})) {
    if (typeof id !== "string" || !id) continue;
    clamped[id] = Math.max(1, Math.min(99, Math.floor(Number(q) || 1)));
  }
  await prisma.order.updateMany({
    where: { userId, status: "DRAFT" },
    data: { selectedQuantities: clamped },
  });
}

// Finalise the DRAFT order after it's been added to the Picnic cart: snapshot
// the chosen products and flip it to PLACED so it appears under previous orders.
export async function placeCurrentOrder(): Promise<void> {
  const userId = await writerId();
  if (!userId) return;

  const draft = await prisma.order.findFirst({
    where: { userId, status: "DRAFT" },
  });
  if (!draft) return;

  const { products, recipeTitles, listTitles, unavailable } = await aggregateOrder(
    userId,
    draft.recipeIds,
    draft.listIds,
    (draft.cartItems as CartItem[] | null) ?? [],
  );
  const chosen = products.filter((p) => draft.selectedProductIds.includes(p.picnicId));
  if (chosen.length === 0) return;

  // Apply user quantity overrides captured in the order overview.
  const overrides = (draft.selectedQuantities ?? {}) as Record<string, number>;

  await prisma.order.update({
    where: { id: draft.id },
    data: {
      status: "PLACED",
      placedAt: new Date(),
      recipeTitles,
      listTitles,
      unavailableItems: unavailable,
      items: {
        create: chosen.map((p) => ({
          grocer: p.grocer,
          picnicId: p.picnicId,
          productName: p.name,
          imageId: p.imageId,
          priceCents: p.priceCents,
          unitQuantity: p.unitQuantity,
          quantity: overrides[p.picnicId] ?? p.quantity,
        })),
      },
    },
  });

  const now = new Date();

  // Stamp each ordered recipe so "My Recipes" can sort by last-ordered date.
  if (draft.recipeIds.length > 0) {
    await prisma.recipe.updateMany({
      where: { id: { in: draft.recipeIds }, userId },
      data: { lastOrderedAt: now },
    });
    revalidatePath("/recipes");
  }

  // Keep week plannings in sync with what was actually ordered.
  if (draft.weekPlanId) {
    // Ordered from an existing planning → just stamp it.
    await prisma.weekPlan.updateMany({
      where: { id: draft.weekPlanId, userId },
      data: { lastOrderedAt: now },
    });
    revalidatePath("/week-plans");
  } else if (draft.recipeIds.length > 0) {
    // Ordered an ad-hoc recipe selection. Match an existing plan with the same
    // recipe set so re-ordering updates it instead of creating a duplicate.
    const orderKey = [...draft.recipeIds].sort().join(",");
    const plans = await prisma.weekPlan.findMany({
      where: { userId },
      select: { id: true, recipeIds: true },
    });
    const existing = plans.find((p) => [...p.recipeIds].sort().join(",") === orderKey);
    if (existing) {
      // Stamping an already-saved plan happens regardless of the auto-save setting.
      await prisma.weekPlan.update({ where: { id: existing.id }, data: { lastOrderedAt: now } });
      revalidatePath("/week-plans");
    } else {
      // Creating a new plan automatically respects the user's preference + threshold.
      const settings = await prisma.user.findUnique({
        where: { id: userId },
        select: { autoWeekPlanEnabled: true, autoWeekPlanMinRecipes: true },
      });
      if (settings?.autoWeekPlanEnabled && draft.recipeIds.length >= settings.autoWeekPlanMinRecipes) {
        const name = (recipeTitles.join(" + ") || "Week plan").slice(0, 200);
        await prisma.weekPlan.create({
          data: { userId, name, recipeIds: draft.recipeIds, lastOrderedAt: now },
        });
        revalidatePath("/week-plans");
      }
    }
  }

  revalidatePath("/settings");
}
