import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/translate";
import { productImageUrl } from "@/lib/picnic";
import OrderActions, { type CartItem } from "./OrderActions";

function euro(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return "€" + (cents / 100).toFixed(2).replace(".", ",");
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
  const byKey = new Map(mappings.map((m) => [m.ingredientKey, m]));

  // Per-recipe breakdown + an aggregated cart (sum duplicate products).
  type Row = {
    raw: string;
    product:
      | { picnicId: string; name: string; imageUrl: string | null; priceCents: number | null; unitQuantity: string | null }
      | null;
  };
  const sections: { id: string; title: string; rows: Row[] }[] = [];
  const cart = new Map<string, CartItem>();
  let unmappedCount = 0;

  for (const recipe of recipes) {
    const rows: Row[] = recipe.ingredients.map((raw) => {
      const m = byKey.get(normalizeIngredient(raw));
      if (!m) {
        unmappedCount++;
        return { raw, product: null };
      }
      const item: CartItem = {
        picnicId: m.picnicId,
        name: m.productName,
        imageUrl: productImageUrl(m.imageId),
        priceCents: m.priceCents,
        unitQuantity: m.unitQuantity,
        quantity: 1,
      };
      const existing = cart.get(m.picnicId);
      if (existing) existing.quantity += 1;
      else cart.set(m.picnicId, { ...item });
      return { raw, product: item };
    });
    sections.push({ id: recipe.id, title: recipe.title, rows });
  }

  const cartItems = [...cart.values()];
  const totalCents = cartItems.reduce(
    (sum, i) => sum + (i.priceCents ?? 0) * i.quantity,
    0,
  );
  const totalProducts = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        ← Back to recipes
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Order overview</h1>
      <p className="mt-1 text-sm text-stone-500">
        {totalProducts} product{totalProducts === 1 ? "" : "s"} from {recipes.length} recipe
        {recipes.length === 1 ? "" : "s"}
        {totalCents ? ` · ${euro(totalCents)} estimated` : ""}
        {unmappedCount > 0 ? (
          <span className="ml-1 font-medium text-amber-700">
            · {unmappedCount} ingredient{unmappedCount === 1 ? "" : "s"} without a product
          </span>
        ) : null}
      </p>

      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <section key={section.id} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{section.title}</h2>
              <Link
                href={`/recipes/${section.id}`}
                className="text-xs text-stone-500 hover:text-brand-600"
              >
                View recipe
              </Link>
            </div>
            <ul className="space-y-2">
              {section.rows.map((row, i) =>
                row.product ? (
                  <li key={i} className="flex items-center gap-3 rounded-lg bg-stone-50 p-2">
                    {row.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.product.imageUrl}
                        alt={row.product.name}
                        className="h-10 w-10 flex-none rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-stone-200">
                        🛒
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.product.name}</p>
                      <p className="text-xs text-stone-500">
                        {[row.product.unitQuantity, euro(row.product.priceCents)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="flex-none text-xs text-stone-400">{row.raw}</span>
                  </li>
                ) : (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-2"
                  >
                    <span className="text-sm text-amber-900">{row.raw}</span>
                    <Link
                      href={`/recipes/${section.id}`}
                      className="flex-none text-xs font-medium text-amber-700 hover:underline"
                    >
                      No product — link one
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6">
        <OrderActions
          items={cartItems}
          totalProducts={totalProducts}
          totalCents={totalCents}
          unmappedCount={unmappedCount}
          picnicLinked={picnicLinked}
        />
      </div>
    </div>
  );
}
