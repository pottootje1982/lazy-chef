import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteRecipe } from "@/app/actions";
import { normalizeIngredient } from "@/lib/translate";
import { productImageUrl } from "@/lib/picnic";
import IngredientList, { type IngredientItem } from "@/components/IngredientList";
import RecipeSelectToggle from "./RecipeSelectToggle";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe || recipe.userId !== session.user.id) notFound();

  // Build the per-ingredient view: pair each line with its saved product mapping.
  const [user, mappings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { picnicAuthKey: true, unavailableIngredients: true },
    }),
    prisma.productMapping.findMany({ where: { userId: session.user.id } }),
  ]);
  const picnicLinked = Boolean(user?.picnicAuthKey);
  const isGuest = Boolean(session.user.isGuest);
  const byKey = new Map(mappings.map((m) => [m.ingredientKey, m]));
  const unavailableSet = new Set(user?.unavailableIngredients ?? []);

  const ingredientItems: IngredientItem[] = recipe.ingredients.map((raw) => {
    const key = normalizeIngredient(raw);
    const m = byKey.get(key);
    return {
      raw,
      ingredientKey: key,
      unavailable: unavailableSet.has(key),
      product: m
        ? {
            mappingId: m.id,
            picnicId: m.picnicId,
            name: m.productName,
            imageUrl: productImageUrl(m.imageId),
            priceCents: m.priceCents,
            unitQuantity: m.unitQuantity,
          }
        : null,
    };
  });

  const deleteAction = deleteRecipe.bind(null, recipe.id);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        ← Back to recipes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{recipe.title}</h1>
          {recipe.description ? (
            <p className="mt-2 text-stone-600">{recipe.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <RecipeSelectToggle recipeId={recipe.id} />
          {isGuest ? null : (
            <>
              <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">
                Edit
              </Link>
              <form action={deleteAction}>
                <button className="btn-danger">Delete</button>
              </form>
            </>
          )}
        </div>
      </div>

      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="mt-6 max-h-96 max-w-full rounded-xl"
        />
      ) : null}

      {recipe.sourceImageUrl ? (
        <p className="mt-2 text-sm text-stone-400">
          <a
            href={recipe.sourceImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            📷 View original scan
          </a>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-6 text-sm text-stone-600">
        {recipe.servings ? (
          <span>
            <strong>Servings:</strong> {recipe.servings}
          </span>
        ) : null}
        {recipe.prepTime ? (
          <span>
            <strong>Prep:</strong> {recipe.prepTime}
          </span>
        ) : null}
        {recipe.cookTime ? (
          <span>
            <strong>Cook:</strong> {recipe.cookTime}
          </span>
        ) : null}
      </div>

      {recipe.tags.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ingredients</h2>
            {isGuest || picnicLinked ? null : (
              <Link href="/settings" className="text-xs text-brand-600 hover:underline">
                Connect Picnic
              </Link>
            )}
          </div>
          <IngredientList
            items={ingredientItems}
            picnicLinked={picnicLinked}
            readOnly={isGuest}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Instructions</h2>
          {recipe.instructions.length ? (
            <ol className="space-y-4 text-sm">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-stone-400">No instructions listed.</p>
          )}
        </section>
      </div>

      {recipe.sourceUrl ? (
        <p className="mt-8 text-sm text-stone-400">
          Source:{" "}
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            {recipe.sourceUrl}
          </a>
        </p>
      ) : null}
    </article>
  );
}
