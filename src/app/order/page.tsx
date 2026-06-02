import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/translate";
import { productImageUrl } from "@/lib/picnic";
import OrderCart, { type OrderItem } from "./OrderCart";

// Pantry staples that usually come in big packs and are likely already in the
// cupboard (the user's examples: olive oil, garlic). Matched against the
// English-normalized ingredient key. Deselected by default — fully overridable.
const STAPLE_KEYWORDS = [
  "oil", "garlic", "salt", "sugar", "flour", "butter", "vinegar", "honey",
  "stock", "broth", "bouillon", "oregano", "thyme", "rosemary", "cumin",
  "paprika", "cinnamon", "nutmeg", "basil", "parsley", "coriander", "soy",
  "baking", "yeast", "water", "mustard",
];
function isStapleKey(key: string): boolean {
  return STAPLE_KEYWORDS.some((s) => key.includes(s));
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (idList.length === 0) redirect("/recipes");

  const [user, recipes, mappings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { picnicAuthKey: true },
    }),
    prisma.recipe.findMany({
      where: { id: { in: idList }, userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productMapping.findMany({ where: { userId: session.user.id } }),
  ]);

  if (recipes.length === 0) redirect("/recipes");

  const picnicLinked = Boolean(user?.picnicAuthKey);
  const isGuest = Boolean(session.user.isGuest);
  const byKey = new Map(mappings.map((m) => [m.ingredientKey, m]));

  // Per-recipe breakdown (for context) + a deduped product list (the cart).
  type Row = { raw: string; productName: string | null };
  const sections: { id: string; title: string; rows: Row[] }[] = [];
  type Agg = OrderItem & { ingredientKey: string };
  const cart = new Map<string, Agg>();
  let unmappedCount = 0;

  for (const recipe of recipes) {
    const rows: Row[] = recipe.ingredients.map((raw) => {
      const m = byKey.get(normalizeIngredient(raw));
      if (!m) {
        unmappedCount++;
        return { raw, productName: null };
      }
      const existing = cart.get(m.picnicId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.set(m.picnicId, {
          picnicId: m.picnicId,
          name: m.productName,
          imageUrl: productImageUrl(m.imageId),
          priceCents: m.priceCents,
          unitQuantity: m.unitQuantity,
          quantity: 1,
          ingredientKey: m.ingredientKey,
          isStaple: isStapleKey(m.ingredientKey),
          defaultSelected: false, // set below
        });
      }
      return { raw, productName: m.productName };
    });
    sections.push({ id: recipe.id, title: recipe.title, rows });
  }

  // Default selection: on, unless it's a staple or appears in >1 recipe.
  const items: OrderItem[] = [...cart.values()].map((it) => ({
    picnicId: it.picnicId,
    name: it.name,
    imageUrl: it.imageUrl,
    priceCents: it.priceCents,
    unitQuantity: it.unitQuantity,
    quantity: it.quantity,
    isStaple: it.isStaple,
    defaultSelected: !it.isStaple && it.quantity < 2,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        ← Back to recipes
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Order overview</h1>
      <p className="mt-1 text-sm text-stone-500">
        {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
        {unmappedCount > 0 ? (
          <span className="ml-1 font-medium text-amber-700">
            · {unmappedCount} ingredient{unmappedCount === 1 ? "" : "s"} without a product
          </span>
        ) : null}
      </p>

      {/* Per-recipe breakdown (context). */}
      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <section key={section.id} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">{section.title}</h2>
              <Link
                href={`/recipes/${section.id}`}
                className="text-xs text-stone-500 hover:text-brand-600"
              >
                View recipe
              </Link>
            </div>
            <ul className="space-y-1 text-sm">
              {section.rows.map((row, i) =>
                row.productName ? (
                  <li key={i} className="flex gap-2">
                    <span className="text-brand-500">•</span>
                    <span className="text-stone-700">{row.raw}</span>
                    <span className="truncate text-stone-400">→ {row.productName}</span>
                  </li>
                ) : (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1"
                  >
                    <span className="text-amber-900">{row.raw}</span>
                    <Link
                      href={`/recipes/${section.id}`}
                      className="flex-none text-xs font-medium text-amber-700 hover:underline"
                    >
                      no product — link one
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>

      {/* Deduped, selectable shopping list + order action. */}
      <OrderCart
        items={items}
        unmappedCount={unmappedCount}
        picnicLinked={picnicLinked}
        isGuest={isGuest}
      />
    </div>
  );
}
