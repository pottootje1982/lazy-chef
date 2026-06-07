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
  searchParams: Promise<{ cat?: string; origin?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { cat, origin } = await searchParams;

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
  const showOnboarding = !filtering && recipes.length === 0 && lists.length === 0;

  // Build a /recipes URL from the given category + origin selections. Each chip
  // toggles its own key while preserving the others.
  const buildHref = (cats: string[], origins: string[]) => {
    const p = new URLSearchParams();
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

  const catLabel = [
    ...activeCats.map((k) => CATEGORIES.find((c) => c.key === k)!.label.toLowerCase()),
    ...activeOrigins.map((k) => ORIGIN_FILTERS.find((o) => o.key === k)!.label.toLowerCase()),
  ].join(" + ");

  // Filter chips (category + origin) rendered inline with the search box by
  // RecipeGrid. Hrefs are server-computed here so they stay bookmarkable.
  const categoryChips = [
    { key: "__all", label: "All", href: allHref, active: !filtering },
    ...CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      href: catHref(c.key),
      active: activeCats.includes(c.key),
    })),
  ];
  const originChipData = originChips.map((o) => ({
    key: o.key,
    label: o.label,
    href: originHref(o.key),
    active: activeOrigins.includes(o.key),
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Recipes</h1>
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
          catLabel={catLabel}
          categoryChips={categoryChips}
          originChips={originChipData}
        />
      )}
    </div>
  );
}
