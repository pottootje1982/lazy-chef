import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createRecipe } from "@/app/actions";
import RecipeForm from "@/components/RecipeForm";

const EMPTY = {
  title: "",
  description: "",
  imageUrl: "",
  sourceImageUrl: "",
  sourceUrl: "",
  servings: "",
  prepTime: "",
  cookTime: "",
  ingredients: [],
  instructions: [],
  tags: [],
  categories: [],
};

export default async function NewRecipePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">New recipe</h1>
      <RecipeForm action={createRecipe} initial={EMPTY} submitLabel="Save recipe" />
    </div>
  );
}
