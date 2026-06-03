"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the non-guest user id, or null if the caller may not write.
async function writerId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.isGuest) return null;
  return session.user.id;
}

// Normalize a pantry keyword the same loose way keys are matched (lowercase,
// trimmed). Empty / overly long values are rejected by the caller.
function cleanKeyword(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 40);
}

export async function addPantryKeyword(formData: FormData): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const word = cleanKeyword(String(formData.get("keyword") ?? ""));
  if (!word) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pantryKeywords: true },
  });
  const current = user?.pantryKeywords ?? [];
  if (current.includes(word)) return;
  await prisma.user.update({
    where: { id: userId },
    data: { pantryKeywords: [...current, word].sort() },
  });
  revalidatePath("/settings");
}

export async function removePantryKeyword(word: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pantryKeywords: true },
  });
  const current = user?.pantryKeywords ?? [];
  await prisma.user.update({
    where: { id: userId },
    data: { pantryKeywords: current.filter((w) => w !== word) },
  });
  revalidatePath("/settings");
}

// Set a per-product pantry override: true = always pantry, false = never,
// null = follow the keyword rule. Applies to every mapping for this product
// (a product can be linked from several ingredient keys).
export async function setProductStaple(
  picnicId: string,
  value: boolean | null,
): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  await prisma.productMapping.updateMany({
    where: { picnicId, userId },
    data: { isStaple: value },
  });
  revalidatePath("/settings");
}
