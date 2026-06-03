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

export async function createWeekPlan(name: string, recipeIds: string[]): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const trimmed = name.trim().slice(0, 200);
  if (!trimmed) return;

  // Keep only recipes that actually belong to the user.
  const owned = await prisma.recipe.findMany({
    where: { id: { in: recipeIds }, userId },
    select: { id: true },
  });
  const ids = owned.map((r) => r.id);
  if (ids.length === 0) return;

  await prisma.weekPlan.create({ data: { userId, name: trimmed, recipeIds: ids } });
  revalidatePath("/week-plans");
}

export async function renameWeekPlan(id: string, name: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const trimmed = name.trim().slice(0, 200);
  if (!trimmed) return;
  await prisma.weekPlan.updateMany({ where: { id, userId }, data: { name: trimmed } });
  revalidatePath("/week-plans");
}

export async function deleteWeekPlan(id: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  await prisma.weekPlan.deleteMany({ where: { id, userId } });
  revalidatePath("/week-plans");
}

// Configure auto-saving an ordered recipe selection as a week plan.
export async function setAutoWeekPlanSettings(
  enabled: boolean,
  minRecipes: number,
): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const min = Math.max(1, Math.min(50, Math.floor(Number(minRecipes) || 3)));
  await prisma.user.update({
    where: { id: userId },
    data: { autoWeekPlanEnabled: Boolean(enabled), autoWeekPlanMinRecipes: min },
  });
  revalidatePath("/settings");
}
