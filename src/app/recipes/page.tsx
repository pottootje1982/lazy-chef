import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="card overflow-hidden transition hover:shadow-md"
            >
              {recipe.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-stone-100 text-4xl">
                  🍽️
                </div>
              )}
              <div className="p-4">
                <h2 className="font-semibold leading-tight">{recipe.title}</h2>
                {recipe.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500">{recipe.description}</p>
                ) : null}
                {recipe.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
