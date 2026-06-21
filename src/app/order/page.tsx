import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateOrder, defaultSelectedIds, sameSelection, type CartItem } from "@/lib/orders";
import { asGrocer, isLinked } from "@/lib/grocer";
import OrderCart from "./OrderCart";
import DraftCartSection from "./DraftCartSection";
import ClearCartButton from "./ClearCartButton";

function parseIds(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; lists?: string; weekPlanId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const isGuest = Boolean(session.user.isGuest);

  const sp = await searchParams;
  let recipeIds = parseIds(sp.ids);
  let listIds = parseIds(sp.lists);
  let weekPlanId = sp.weekPlanId?.trim() || null;
  const noParams = recipeIds.length === 0 && listIds.length === 0;

  // The user's single DRAFT order — also the "basket" opened from the top menu.
  const draft = isGuest
    ? null
    : await prisma.order.findFirst({ where: { userId, status: "DRAFT" } });

  // No params → opened from the nav basket: resume the existing draft.
  if (noParams) {
    if (!draft) redirect("/recipes");
    recipeIds = draft.recipeIds;
    listIds = draft.listIds;
    weekPlanId = draft.weekPlanId ?? null;
  }

  const cartItems = (draft?.cartItems as CartItem[] | null) ?? [];

  const [user, agg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { picnicAuthKey: true, ahAuthKey: true, grocer: true },
    }),
    aggregateOrder(userId, recipeIds, listIds, cartItems),
  ]);
  if (agg.sections.length === 0) redirect("/recipes");

  const grocer = asGrocer(user?.grocer);
  const picnicLinked =
    !!user &&
    isLinked(grocer, { id: userId, grocer, picnicAuthKey: user.picnicAuthKey, ahAuthKey: user.ahAuthKey });
  const tg = await getTranslations("grocer");
  const grocerName = tg(grocer);
  const grocerUrl = grocer === "ah" ? "https://www.ah.nl/mijnlijst" : "https://picnic.app";
  const t = await getTranslations("order");

  // Persist the current order as a DRAFT (selected recipes + lists + products)
  // so the selection survives reloads. Guests don't persist anything.
  let initialSelectedIds = defaultSelectedIds(agg.products);
  let initialQuantities: Record<string, number> = {};
  if (!isGuest) {
    if (draft && sameSelection(draft.recipeIds, draft.listIds, recipeIds, listIds)) {
      initialSelectedIds = draft.selectedProductIds;
      initialQuantities = (draft.selectedQuantities ?? {}) as Record<string, number>;
      // Refresh the plan link (set when ordering a plan, cleared for a normal order).
      if (draft.weekPlanId !== weekPlanId) {
        await prisma.order.update({ where: { id: draft.id }, data: { weekPlanId } });
      }
    } else {
      const data = {
        recipeIds,
        recipeTitles: agg.recipeTitles,
        listIds,
        listTitles: agg.listTitles,
        selectedProductIds: initialSelectedIds,
        selectedQuantities: {},
        weekPlanId,
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
        {t("backToRecipes")}
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {isGuest ? null : <ClearCartButton />}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {t("summary", { count: sourceCount })}
        {agg.unmappedCount > 0 ? (
          <span className="ml-1 font-medium text-amber-700">
            {t("unmappedNote", { count: agg.unmappedCount })}
          </span>
        ) : null}
      </p>

      {agg.unavailable.length ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800">{t("notAvailableTitle")}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
            {agg.unavailable.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Basket-added products (the in-app cart), with remove buttons. */}
      {cartItems.length > 0 ? (
        <DraftCartSection
          title={t("addedItems")}
          items={cartItems.map((c) => ({ picnicId: c.picnicId, name: c.name }))}
        />
      ) : null}

      {/* Per-source breakdown (recipes + grocery lists). */}
      <div className="mt-6 space-y-4">
        {agg.sections
          .filter((section) => section.kind !== "cart")
          .map((section) => (
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
                {section.kind === "list" ? t("editList") : t("viewRecipe")}
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
                      {t("noProductLink")}
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
        grocerName={grocerName}
        grocerUrl={grocerUrl}
      />
    </div>
  );
}
