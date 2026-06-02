import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/translate";
import { productImageUrl } from "@/lib/picnic";

// Pantry staples that usually come in big packs and are likely already owned
// (e.g. olive oil, garlic). Matched against the English-normalized ingredient
// key. Deselected by default — overridable.
const STAPLE_KEYWORDS = [
  "oil", "garlic", "salt", "sugar", "flour", "butter", "vinegar", "honey",
  "stock", "broth", "bouillon", "oregano", "thyme", "rosemary", "cumin",
  "paprika", "cinnamon", "nutmeg", "basil", "parsley", "coriander", "soy",
  "baking", "yeast", "water", "mustard",
];
export function isStapleKey(key: string): boolean {
  return STAPLE_KEYWORDS.some((s) => key.includes(s));
}

export type OrderProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number;
  isStaple: boolean;
  defaultSelected: boolean;
};

export type OrderRecipeRow = { raw: string; productName: string | null };

export type AggregatedOrder = {
  recipeTitles: string[];
  perRecipe: { id: string; title: string; rows: OrderRecipeRow[] }[];
  products: OrderProduct[];
  unmappedCount: number;
};

// Resolve the selected recipes into a per-recipe breakdown and a deduped list
// of products (summing duplicates). Shared by the order page and place action
// so both compute identical results.
export async function aggregateOrder(
  userId: string,
  recipeIds: string[],
): Promise<AggregatedOrder> {
  const [recipes, mappings] = await Promise.all([
    prisma.recipe.findMany({
      where: { id: { in: recipeIds }, userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productMapping.findMany({ where: { userId } }),
  ]);

  const byKey = new Map(mappings.map((m) => [m.ingredientKey, m]));
  const cart = new Map<string, OrderProduct & { ingredientKey: string }>();
  let unmappedCount = 0;

  const perRecipe = recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    rows: recipe.ingredients.map((raw): OrderRecipeRow => {
      const m = byKey.get(normalizeIngredient(raw));
      if (!m) {
        unmappedCount++;
        return { raw, productName: null };
      }
      const existing = cart.get(m.picnicId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.set(m.picnicId, {
          picnicId: m.picnicId,
          name: m.productName,
          imageId: m.imageId,
          imageUrl: productImageUrl(m.imageId),
          priceCents: m.priceCents,
          unitQuantity: m.unitQuantity,
          quantity: 1,
          ingredientKey: m.ingredientKey,
          isStaple: false,
          defaultSelected: false,
        });
      }
      return { raw, productName: m.productName };
    }),
  }));

  const products: OrderProduct[] = [...cart.values()].map((it) => {
    const isStaple = isStapleKey(it.ingredientKey);
    return {
      picnicId: it.picnicId,
      name: it.name,
      imageId: it.imageId,
      imageUrl: it.imageUrl,
      priceCents: it.priceCents,
      unitQuantity: it.unitQuantity,
      quantity: it.quantity,
      isStaple,
      // Default on, unless it's a staple or used in more than one recipe.
      defaultSelected: !isStaple && it.quantity < 2,
    };
  });

  return { recipeTitles: recipes.map((r) => r.title), perRecipe, products, unmappedCount };
}

export function defaultSelectedIds(products: OrderProduct[]): string[] {
  return products.filter((p) => p.defaultSelected).map((p) => p.picnicId);
}

export function sameRecipeSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}
