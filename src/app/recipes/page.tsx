import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RecipeGrid from "./RecipeGrid";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q } = await searchParams;
  const query = q?.trim();

  const recipes = await prisma.recipe.findMany({
    where: {
      userId: session.user.id,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { tags: { has: query.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Recipes</h1>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search title or tag…"
            className="input max-w-xs"
          />
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {recipes.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          {query ? (
            <p>No recipes match “{query}”.</p>
          ) : (
            <>
              <p className="mb-4">You don&apos;t have any recipes yet.</p>
              <div className="flex justify-center gap-3">
                <Link href="/recipes/new" className="btn-primary">
                  Add one manually
                </Link>
                <Link href="/recipes/import" className="btn-secondary">
                  Import from a URL
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-500">
            Tip: select recipes with the checkboxes to order their ingredients from Picnic.
          </p>
          <RecipeGrid
            recipes={recipes.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              imageUrl: r.imageUrl,
              tags: r.tags,
            }))}
          />
        </>
      )}
    </div>
  );
}
