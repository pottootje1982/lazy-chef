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
