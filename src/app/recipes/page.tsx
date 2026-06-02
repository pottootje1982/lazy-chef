import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RecipeGrid from "./RecipeGrid";

const CATEGORIES = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "fish", label: "Fish" },
  { key: "meat", label: "Meat" },
  { key: "dessert", label: "Dessert" },
] as const;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, cat } = await searchParams;
  const query = q?.trim();
  const activeCat = CATEGORIES.find((c) => c.key === cat)?.key;

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
        ...(activeCat ? { categories: { has: activeCat } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.groceryList.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  // Hide pinned grocery lists while filtering by recipe category.
  const listCards = activeCat
    ? []
    : lists.map((l) => ({ id: l.id, name: l.name, itemCount: l._count.items }));
  const showOnboarding = !query && !activeCat && recipes.length === 0 && lists.length === 0;

  // Build a category chip href, preserving the active search term.
  const chipHref = (key?: string) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (key) p.set("cat", key);
    const s = p.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };
  const activeLabel = CATEGORIES.find((c) => c.key === activeCat)?.label;

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
          {activeCat ? <input type="hidden" name="cat" value={activeCat} /> : null}
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {/* Category filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={chipHref()}
          className={`rounded-full px-3 py-1 text-sm transition ${
            !activeCat
              ? "bg-brand-600 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={chipHref(c.key)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              activeCat === c.key
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {c.label}
          </Link>
        ))}
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
          {recipes.length === 0 ? (
            <p className="mb-4 text-stone-500">
              No {activeLabel ? `${activeLabel.toLowerCase()} ` : ""}recipes
              {query ? ` match “${query}”` : ""}.
            </p>
          ) : (
            <p className="mb-4 text-sm text-stone-500">
              {activeLabel ? `${recipes.length} ${activeLabel.toLowerCase()} ` : "Tip: select "}
              {activeLabel
                ? `recipe${recipes.length === 1 ? "" : "s"}.`
                : "recipes or grocery lists with the checkboxes to order from Picnic."}
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
