import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRecipe } from "@/app/actions";
import RecipeForm from "@/components/RecipeForm";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe || recipe.userId !== session.user.id) notFound();

  const action = updateRecipe.bind(null, recipe.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Edit recipe</h1>
      <RecipeForm
        action={action}
        submitLabel="Save changes"
        initial={{
          title: recipe.title,
          description: recipe.description ?? "",
          imageUrl: recipe.imageUrl ?? "",
          sourceImageUrl: recipe.sourceImageUrl ?? "",
          sourceUrl: recipe.sourceUrl ?? "",
          servings: recipe.servings ?? "",
          prepTime: recipe.prepTime ?? "",
          cookTime: recipe.cookTime ?? "",
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          tags: recipe.tags,
          categories: recipe.categories,
        }}
      />
    </div>
  );
}
