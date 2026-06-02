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

  // Multiple categories allowed (comma-separated); a recipe matching ANY of
  // them is shown (OR via Prisma `hasSome`).
  const validKeys = new Set(CATEGORIES.map((c) => c.key as string));
  const activeCats = [
    ...new Set((cat ?? "").split(",").map((s) => s.trim()).filter((s) => validKeys.has(s))),
  ];

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
        ...(activeCats.length ? { categories: { hasSome: activeCats } } : {}),
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
  const listCards = activeCats.length
    ? []
    : lists.map((l) => ({ id: l.id, name: l.name, itemCount: l._count.items }));
  const showOnboarding =
    !query && activeCats.length === 0 && recipes.length === 0 && lists.length === 0;

  // Toggle a chip in/out of the active set, preserving the search term.
  // `key` undefined = the "All" chip (clears categories).
  const chipHref = (key?: string) => {
    const next = !key
      ? []
      : activeCats.includes(key)
        ? activeCats.filter((k) => k !== key)
        : [...activeCats, key];
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (next.length) p.set("cat", next.join(","));
    const s = p.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };
  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition ${
      active ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
    }`;
  const catLabel = activeCats
    .map((k) => CATEGORIES.find((c) => c.key === k)!.label.toLowerCase())
    .join(" or ");

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
          {activeCats.length ? <input type="hidden" name="cat" value={activeCats.join(",")} /> : null}
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {/* Category filter chips (multi-select, OR) */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={chipHref()} className={chipClass(activeCats.length === 0)}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.key} href={chipHref(c.key)} className={chipClass(activeCats.includes(c.key))}>
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
              No {catLabel ? `${catLabel} ` : ""}recipes
              {query ? ` match “${query}”` : ""}.
            </p>
          ) : (
            <p className="mb-4 text-sm text-stone-500">
              {catLabel
                ? `${recipes.length} ${catLabel} recipe${recipes.length === 1 ? "" : "s"}.`
                : "Tip: select recipes or grocery lists with the checkboxes to order from Picnic."}
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
