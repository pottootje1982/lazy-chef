"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recipeSchema } from "@/lib/validation";

export type FormState = { error?: string } | undefined;

// Parse the multi-value form fields produced by RecipeForm.
function parseForm(formData: FormData) {
  const clean = (v: FormDataEntryValue | null) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  const list = (key: string) =>
    formData
      .getAll(key)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);

  return recipeSchema.safeParse({
    title: clean(formData.get("title")) ?? "",
    description: clean(formData.get("description")) ?? "",
    imageUrl: clean(formData.get("imageUrl")) ?? "",
    sourceImageUrl: clean(formData.get("sourceImageUrl")) ?? "",
    sourceUrl: clean(formData.get("sourceUrl")) ?? "",
    servings: clean(formData.get("servings")) ?? "",
    prepTime: clean(formData.get("prepTime")) ?? "",
    cookTime: clean(formData.get("cookTime")) ?? "",
    ingredients: list("ingredients"),
    instructions: list("instructions"),
    tags: list("tags"),
    categories: list("categories"),
  });
}

async function requireUser(): Promise<{ id: string; isGuest: boolean }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, isGuest: Boolean(session.user.isGuest) };
}

const GUEST_ERROR = "This is a read-only guest account. Sign in to make changes.";

export async function createRecipe(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId, isGuest } = await requireUser();
  if (isGuest) return { error: GUEST_ERROR };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const recipe = await prisma.recipe.create({
    data: {
      userId,
      title: data.title,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      sourceImageUrl: data.sourceImageUrl || null,
      sourceUrl: data.sourceUrl || null,
      servings: data.servings || null,
      prepTime: data.prepTime || null,
      cookTime: data.cookTime || null,
      ingredients: data.ingredients,
      instructions: data.instructions,
      tags: data.tags,
      categories: data.categories,
    },
  });

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId, isGuest } = await requireUser();
  if (isGuest) return { error: GUEST_ERROR };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Ownership check before mutating.
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return { error: "Recipe not found." };
  }

  const data = parsed.data;
  await prisma.recipe.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      sourceImageUrl: data.sourceImageUrl || null,
      sourceUrl: data.sourceUrl || null,
      servings: data.servings || null,
      prepTime: data.prepTime || null,
      cookTime: data.cookTime || null,
      ingredients: data.ingredients,
      instructions: data.instructions,
      tags: data.tags,
      categories: data.categories,
    },
  });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function deleteRecipe(id: string): Promise<void> {
  const { id: userId, isGuest } = await requireUser();
  if (isGuest) redirect(`/recipes/${id}`); // read-only guest: no-op
  // deleteMany scopes by userId so users can only delete their own recipes.
  await prisma.recipe.deleteMany({ where: { id, userId } });
  revalidatePath("/recipes");
  redirect("/recipes");
}
