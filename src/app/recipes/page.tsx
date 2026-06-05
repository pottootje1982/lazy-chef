import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RECIPE_CATEGORIES as CATEGORIES } from "@/lib/categories";
import RecipeGrid from "./RecipeGrid";

// Origin-based filter chips (shown only when the user has such recipes).
const ORIGIN_FILTERS = [
  { key: "scan", label: "📷 Scanned" },
  { key: "paprika", label: "From Paprika" },
] as const;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; origin?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, cat, origin } = await searchParams;
  const query = q?.trim();

  // Multiple categories allowed (comma-separated); a recipe matching ANY of
  // them is shown (OR via Prisma `hasSome`).
  const validKeys = new Set(CATEGORIES.map((c) => c.key as string));
  const activeCats = [
    ...new Set((cat ?? "").split(",").map((s) => s.trim()).filter((s) => validKeys.has(s))),
  ];
  const validOrigins = new Set(ORIGIN_FILTERS.map((o) => o.key as string));
  const activeOrigins = [
    ...new Set((origin ?? "").split(",").map((s) => s.trim()).filter((s) => validOrigins.has(s))),
  ];

  const [recipes, lists, originRows] = await Promise.all([
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
        ...(activeOrigins.length ? { origin: { in: activeOrigins } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.groceryList.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    // Which origin chips to show: only those the user actually has.
    prisma.recipe.findMany({
      where: { userId: session.user.id, origin: { in: ORIGIN_FILTERS.map((o) => o.key) } },
      select: { origin: true },
      distinct: ["origin"],
    }),
  ]);

  const existingOrigins = new Set(originRows.map((r) => r.origin));
  const originChips = ORIGIN_FILTERS.filter((o) => existingOrigins.has(o.key));
  const filtering = activeCats.length > 0 || activeOrigins.length > 0;

  // Hide pinned grocery lists while filtering recipes.
  const listCards = filtering
    ? []
    : lists.map((l) => ({ id: l.id, name: l.name, itemCount: l._count.items }));
  const showOnboarding = !query && !filtering && recipes.length === 0 && lists.length === 0;

  // Build a /recipes URL from the given category + origin selections, keeping
  // the search term. Each chip toggles its own key while preserving the others.
  const buildHref = (cats: string[], origins: string[]) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (cats.length) p.set("cat", cats.join(","));
    if (origins.length) p.set("origin", origins.join(","));
    const s = p.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };
  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  const catHref = (key?: string) => buildHref(key ? toggle(activeCats, key) : [], activeOrigins);
  const originHref = (key: string) => buildHref(activeCats, toggle(activeOrigins, key));
  const allHref = buildHref([], []); // clears every filter

  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition ${
      active ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
    }`;
  const catLabel = [
    ...activeCats.map((k) => CATEGORIES.find((c) => c.key === k)!.label.toLowerCase()),
    ...activeOrigins.map((k) => ORIGIN_FILTERS.find((o) => o.key === k)!.label.toLowerCase()),
  ].join(" + ");

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
          {activeOrigins.length ? (
            <input type="hidden" name="origin" value={activeOrigins.join(",")} />
          ) : null}
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {/* Filter chips: categories (multi-select, OR) + origin (only when present) */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={allHref} className={chipClass(!filtering)}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.key} href={catHref(c.key)} className={chipClass(activeCats.includes(c.key))}>
            {c.label}
          </Link>
        ))}
        {originChips.length ? (
          <span className="mx-1 self-center text-stone-300" aria-hidden>
            |
          </span>
        ) : null}
        {originChips.map((o) => (
          <Link key={o.key} href={originHref(o.key)} className={chipClass(activeOrigins.includes(o.key))}>
            {o.label}
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
              origin: r.origin,
              createdAt: r.createdAt.toISOString(),
              lastOrderedAt: r.lastOrderedAt?.toISOString() ?? null,
            }))}
            lists={listCards}
          />
        </>
      )}
    </div>
  );
}
