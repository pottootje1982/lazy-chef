"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateOrder } from "@/lib/orders";

// Returns the non-guest user id, or null if not allowed to persist orders.
async function writerId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.isGuest) return null;
  return session.user.id;
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

// Finalise the DRAFT order after it's been added to the Picnic cart: snapshot
// the chosen products and flip it to PLACED so it appears under previous orders.
export async function placeCurrentOrder(): Promise<void> {
  const userId = await writerId();
  if (!userId) return;

  const draft = await prisma.order.findFirst({
    where: { userId, status: "DRAFT" },
  });
  if (!draft) return;

  const { products, recipeTitles, listTitles } = await aggregateOrder(
    userId,
    draft.recipeIds,
    draft.listIds,
  );
  const chosen = products.filter((p) => draft.selectedProductIds.includes(p.picnicId));
  if (chosen.length === 0) return;

  await prisma.order.update({
    where: { id: draft.id },
    data: {
      status: "PLACED",
      placedAt: new Date(),
      recipeTitles,
      listTitles,
      items: {
        create: chosen.map((p) => ({
          picnicId: p.picnicId,
          productName: p.name,
          imageId: p.imageId,
          priceCents: p.priceCents,
          unitQuantity: p.unitQuantity,
          quantity: p.quantity,
        })),
      },
    },
  });

  revalidatePath("/settings");
}
