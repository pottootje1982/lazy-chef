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

  const [recipes, lists] = await Promise.all([
    prisma.recipe.findMany({
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
    }),
    prisma.groceryList.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const listCards = lists.map((l) => ({ id: l.id, name: l.name, itemCount: l._count.items }));
  const showOnboarding = !query && recipes.length === 0 && lists.length === 0;

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

      {showOnboarding ? (
        <div className="card p-10 text-center text-stone-500">
          <p className="mb-4">You don&apos;t have any recipes yet.</p>
          <div className="flex justify-center gap-3">
            <Link href="/recipes/new" className="btn-primary">
              Add one manually
            </Link>
            <Link href="/recipes/import" className="btn-secondary">
              Import from a URL
            </Link>
          </div>
        </div>
      ) : (
        <>
          {query && recipes.length === 0 ? (
            <p className="mb-4 text-stone-500">No recipes match “{query}”.</p>
          ) : (
            <p className="mb-4 text-sm text-stone-500">
              Tip: select recipes or grocery lists with the checkboxes to order from Picnic.
            </p>
          )}
          <RecipeGrid
            recipes={recipes.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              imageUrl: r.imageUrl,
              tags: r.tags,
            }))}
            lists={listCards}
          />
        </>
      )}
    </div>
  );
}
