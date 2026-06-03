import { prisma } from "@/lib/prisma";
import { normalizeIngredient, parseCount } from "@/lib/translate";
import { productImageUrl } from "@/lib/picnic";

// A linked ingredient is a pantry staple when its normalized key contains one
// of the user's pantry keywords. The keyword list is user-managed (Settings).
function matchesPantryKeywords(key: string, keywords: string[]): boolean {
  return keywords.some((s) => s && key.includes(s));
}

export type OrderProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number; // amount to order (summed countable amounts / list quantities)
  recipeCount: number; // how many recipe ingredient lines reference this product
  isStaple: boolean;
  defaultSelected: boolean;
};

// A line in a breakdown section. For recipe ingredients, `label` is the raw
// ingredient and `mappedName` is the linked product (null + unmapped = no link).
// For grocery items, `label` is the product name and it's always mapped.
export type OrderRow = { label: string; mappedName: string | null; unmapped: boolean };

export type OrderSection = {
  id: string;
  title: string;
  kind: "recipe" | "list";
  rows: OrderRow[];
};

export type AggregatedOrder = {
  recipeTitles: string[];
  listTitles: string[];
  sections: OrderSection[];
  products: OrderProduct[];
  unmappedCount: number;
  unavailable: string[]; // ingredient lines flagged not-available (buy elsewhere)
};

type CartEntry = OrderProduct & {
  ingredientKey: string;
  fromGrocery: boolean;
  stapleOverride: boolean | null; // per-mapping pantry override (null = use keywords)
};

// Resolve the selected recipes + grocery lists into per-source breakdown
// sections and a deduped list of products (summing duplicates). Shared by the
// order page and place action so both compute identical results.
export async function aggregateOrder(
  userId: string,
  recipeIds: string[],
  listIds: string[] = [],
): Promise<AggregatedOrder> {
  const [recipes, mappings, lists, user] = await Promise.all([
    prisma.recipe.findMany({
      where: { id: { in: recipeIds }, userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productMapping.findMany({ where: { userId } }),
    prisma.groceryList.findMany({
      where: { id: { in: listIds }, userId },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { pantryKeywords: true, unavailableIngredients: true },
    }),
  ]);
  const pantryKeywords = user?.pantryKeywords ?? [];
  const unavailableSet = new Set(user?.unavailableIngredients ?? []);

  const byKey = new Map(mappings.map((m) => [m.ingredientKey, m]));
  const cart = new Map<string, CartEntry>();
  let unmappedCount = 0;
  const sections: OrderSection[] = [];
  // Distinct not-available ingredient lines across the ordered recipes.
  const unavailable = new Map<string, string>(); // key → representative raw line

  // Recipes → ingredients → mapped products.
  for (const recipe of recipes) {
    const rows = recipe.ingredients.map((raw): OrderRow => {
      const key = normalizeIngredient(raw);
      if (unavailableSet.has(key) && !unavailable.has(key)) unavailable.set(key, raw.trim());
      const m = byKey.get(key);
      if (!m) {
        unmappedCount++;
        return { label: raw, mappedName: null, unmapped: true };
      }
      const n = parseCount(raw);
      const existing = cart.get(m.picnicId);
      if (existing) {
        existing.quantity += n;
        existing.recipeCount += 1;
      } else {
        cart.set(m.picnicId, {
          picnicId: m.picnicId,
          name: m.productName,
          imageId: m.imageId,
          imageUrl: productImageUrl(m.imageId),
          priceCents: m.priceCents,
          unitQuantity: m.unitQuantity,
          quantity: n,
          recipeCount: 1,
          ingredientKey: m.ingredientKey,
          isStaple: false,
          defaultSelected: false,
          fromGrocery: false,
          stapleOverride: m.isStaple,
        });
      }
      return { label: raw, mappedName: m.productName, unmapped: false };
    });
    sections.push({ id: recipe.id, title: recipe.title, kind: "recipe", rows });
  }

  // Grocery lists → products directly.
  for (const list of lists) {
    const rows = list.items.map((it): OrderRow => {
      const existing = cart.get(it.picnicId);
      if (existing) {
        existing.quantity += it.quantity;
        existing.fromGrocery = true;
      } else {
        cart.set(it.picnicId, {
          picnicId: it.picnicId,
          name: it.productName,
          imageId: it.imageId,
          imageUrl: productImageUrl(it.imageId),
          priceCents: it.priceCents,
          unitQuantity: it.unitQuantity,
          quantity: it.quantity,
          recipeCount: 0,
          ingredientKey: "",
          isStaple: false,
          defaultSelected: false,
          fromGrocery: true,
          stapleOverride: null,
        });
      }
      return { label: it.productName, mappedName: null, unmapped: false };
    });
    sections.push({ id: list.id, title: list.name, kind: "list", rows });
  }

  const products: OrderProduct[] = [...cart.values()].map((it) => {
    const isStaple = it.stapleOverride ?? matchesPantryKeywords(it.ingredientKey, pantryKeywords);
    return {
      picnicId: it.picnicId,
      name: it.name,
      imageId: it.imageId,
      imageUrl: it.imageUrl,
      priceCents: it.priceCents,
      unitQuantity: it.unitQuantity,
      quantity: it.quantity,
      recipeCount: it.recipeCount,
      isStaple,
      // Grocery items are intentionally curated → default on. Recipe-only
      // products default on unless a staple or used in more than one recipe.
      defaultSelected: it.fromGrocery ? true : !isStaple && it.recipeCount < 2,
    };
  });

  return {
    recipeTitles: recipes.map((r) => r.title),
    listTitles: lists.map((l) => l.name),
    sections,
    products,
    unmappedCount,
    unavailable: [...unavailable.values()],
  };
}

export function defaultSelectedIds(products: OrderProduct[]): string[] {
  return products.filter((p) => p.defaultSelected).map((p) => p.picnicId);
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

// A DRAFT can be resumed only when both the recipe and list selections match.
export function sameSelection(
  draftRecipeIds: string[],
  draftListIds: string[],
  recipeIds: string[],
  listIds: string[],
): boolean {
  return sameSet(draftRecipeIds, recipeIds) && sameSet(draftListIds, listIds);
}
