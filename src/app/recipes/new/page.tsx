import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  origin: "manual",
};

export default async function NewRecipePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("recipeForm");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{t("newTitle")}</h1>
      <RecipeForm action={createRecipe} initial={EMPTY} submitLabel={t("save")} />
    </div>
  );
}
