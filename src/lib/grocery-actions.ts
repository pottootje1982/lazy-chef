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

export async function createList(name: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return;
  await prisma.groceryList.create({ data: { userId, name: trimmed } });
  revalidatePath("/groceries");
}

export async function renameList(id: string, name: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return;
  await prisma.groceryList.updateMany({ where: { id, userId }, data: { name: trimmed } });
  revalidatePath("/groceries");
}

export async function deleteList(id: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  await prisma.groceryList.deleteMany({ where: { id, userId } });
  revalidatePath("/groceries");
}

export type GroceryProductInput = {
  picnicId: string;
  name: string;
  imageId?: string | null;
  priceCents?: number | null;
  unitQuantity?: string | null;
};

export async function addGroceryItem(
  listId: string,
  product: GroceryProductInput,
): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  if (!product?.picnicId || !product.name) return;

  // Ownership check before mutating.
  const list = await prisma.groceryList.findFirst({ where: { id: listId, userId } });
  if (!list) return;

  await prisma.groceryItem.upsert({
    where: { listId_picnicId: { listId, picnicId: product.picnicId } },
    create: {
      listId,
      picnicId: product.picnicId,
      productName: product.name,
      imageId: product.imageId ?? null,
      priceCents: product.priceCents ?? null,
      unitQuantity: product.unitQuantity ?? null,
    },
    update: {
      productName: product.name,
      imageId: product.imageId ?? null,
      priceCents: product.priceCents ?? null,
      unitQuantity: product.unitQuantity ?? null,
    },
  });
  revalidatePath("/groceries");
}

export async function removeGroceryItem(itemId: string): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  // Scope deletion to the caller's lists.
  await prisma.groceryItem.deleteMany({ where: { id: itemId, list: { userId } } });
  revalidatePath("/groceries");
}
