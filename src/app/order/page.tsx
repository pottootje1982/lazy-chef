import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateOrder, defaultSelectedIds, sameSelection } from "@/lib/orders";
import OrderCart from "./OrderCart";

function parseIds(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; lists?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const isGuest = Boolean(session.user.isGuest);

  const sp = await searchParams;
  const recipeIds = parseIds(sp.ids);
  const listIds = parseIds(sp.lists);
  if (recipeIds.length === 0 && listIds.length === 0) redirect("/recipes");

  const [user, agg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { picnicAuthKey: true } }),
    aggregateOrder(userId, recipeIds, listIds),
  ]);
  if (agg.sections.length === 0) redirect("/recipes");

  const picnicLinked = Boolean(user?.picnicAuthKey);

  // Persist the current order as a DRAFT (selected recipes + lists + products)
  // so the selection survives reloads. Guests don't persist anything.
  let initialSelectedIds = defaultSelectedIds(agg.products);
  let initialQuantities: Record<string, number> = {};
  if (!isGuest) {
    const draft = await prisma.order.findFirst({ where: { userId, status: "DRAFT" } });
    if (draft && sameSelection(draft.recipeIds, draft.listIds, recipeIds, listIds)) {
      initialSelectedIds = draft.selectedProductIds;
      initialQuantities = (draft.selectedQuantities ?? {}) as Record<string, number>;
    } else {
      const data = {
        recipeIds,
        recipeTitles: agg.recipeTitles,
        listIds,
        listTitles: agg.listTitles,
        selectedProductIds: initialSelectedIds,
        selectedQuantities: {},
        status: "DRAFT" as const,
      };
      if (draft) await prisma.order.update({ where: { id: draft.id }, data });
      else await prisma.order.create({ data: { userId, ...data } });
    }
  }

  const sourceCount = agg.sections.length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        ← Back to recipes
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Order overview</h1>
      <p className="mt-1 text-sm text-stone-500">
        {sourceCount} list{sourceCount === 1 ? "" : "s"} &amp; recipes
        {agg.unmappedCount > 0 ? (
          <span className="ml-1 font-medium text-amber-700">
            · {agg.unmappedCount} ingredient{agg.unmappedCount === 1 ? "" : "s"} without a product
          </span>
        ) : null}
      </p>

      {/* Per-source breakdown (recipes + grocery lists). */}
      <div className="mt-6 space-y-4">
        {agg.sections.map((section) => (
          <section key={`${section.kind}-${section.id}`} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">
                {section.kind === "list" ? "🛒 " : ""}
                {section.title}
              </h2>
              <Link
                href={section.kind === "list" ? "/groceries" : `/recipes/${section.id}`}
                className="text-xs text-stone-500 hover:text-brand-600"
              >
                {section.kind === "list" ? "Edit list" : "View recipe"}
              </Link>
            </div>
            <ul className="space-y-1 text-sm">
              {section.rows.map((row, i) =>
                row.unmapped ? (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1"
                  >
                    <span className="text-amber-900">{row.label}</span>
                    <Link
                      href={`/recipes/${section.id}`}
                      className="flex-none text-xs font-medium text-amber-700 hover:underline"
                    >
                      no product — link one
                    </Link>
                  </li>
                ) : (
                  <li key={i} className="flex gap-2">
                    <span className="text-brand-500">•</span>
                    <span className="text-stone-700">{row.label}</span>
                    {row.mappedName ? (
                      <span className="truncate text-stone-400">→ {row.mappedName}</span>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>

      {/* Deduped, selectable shopping list + order action. */}
      <OrderCart
        items={agg.products.map((p) => ({
          picnicId: p.picnicId,
          name: p.name,
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          unitQuantity: p.unitQuantity,
          quantity: p.quantity,
          recipeCount: p.recipeCount,
          isStaple: p.isStaple,
        }))}
        initialSelectedIds={initialSelectedIds}
        initialQuantities={initialQuantities}
        unmappedCount={agg.unmappedCount}
        picnicLinked={picnicLinked}
        isGuest={isGuest}
      />
    </div>
  );
}
