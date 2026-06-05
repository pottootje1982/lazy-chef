"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the non-guest user id, or null if the caller may not write.
async function writerId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.isGuest) return null;
  return session.user.id;
}

// Hide a junk ingredient (by normalized key) from the linking page. No
// revalidate: the client updates optimistically; the next load reads the DB.
export async function ignoreIngredient(key: string): Promise<void> {
  const userId = await writerId();
  if (!userId || !key) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ignoredIngredients: true },
  });
  const current = user?.ignoredIngredients ?? [];
  if (current.includes(key)) return;
  await prisma.user.update({
    where: { id: userId },
    data: { ignoredIngredients: [...current, key] },
  });
}

// Flag an ingredient as not available at the grocer (must be bought elsewhere).
export async function markIngredientUnavailable(key: string): Promise<void> {
  const userId = await writerId();
  if (!userId || !key) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unavailableIngredients: true },
  });
  const current = user?.unavailableIngredients ?? [];
  if (current.includes(key)) return;
  await prisma.user.update({
    where: { id: userId },
    data: { unavailableIngredients: [...current, key] },
  });
}

export async function markIngredientAvailable(key: string): Promise<void> {
  const userId = await writerId();
  if (!userId || !key) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unavailableIngredients: true },
  });
  const current = user?.unavailableIngredients ?? [];
  await prisma.user.update({
    where: { id: userId },
    data: { unavailableIngredients: current.filter((k) => k !== key) },
  });
}

// Set a per-recipe order-quantity override for one ingredient (by normalized
// key). Overrides what parseCount derives from the line — e.g. "1.5 kg spinazie"
// → order 3 bags. Optimistic on the client; next load reads the DB.
export async function setIngredientQuantity(
  recipeId: string,
  ingredientKey: string,
  quantity: number,
): Promise<void> {
  const userId = await writerId();
  if (!userId || !recipeId || !ingredientKey) return;
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, userId },
    select: { quantityOverrides: true },
  });
  if (!recipe) return;
  const q = Math.max(1, Math.min(99, Math.floor(quantity)));
  const overrides = { ...((recipe.quantityOverrides as Record<string, number> | null) ?? {}) };
  overrides[ingredientKey] = q;
  await prisma.recipe.update({ where: { id: recipeId }, data: { quantityOverrides: overrides } });
}

// Remove the product mapping for an ingredient (by normalized key), so it shows
// as unlinked again. Optimistic on the client; next load reads the DB.
export async function unlinkIngredient(key: string): Promise<void> {
  const userId = await writerId();
  if (!userId || !key) return;
  await prisma.productMapping.deleteMany({ where: { userId, ingredientKey: key } });
}

export async function unignoreIngredient(key: string): Promise<void> {
  const userId = await writerId();
  if (!userId || !key) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ignoredIngredients: true },
  });
  const current = user?.ignoredIngredients ?? [];
  await prisma.user.update({
    where: { id: userId },
    data: { ignoredIngredients: current.filter((k) => k !== key) },
  });
}
