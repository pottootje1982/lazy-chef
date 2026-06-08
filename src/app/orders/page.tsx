import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("orders");
  const locale = await getLocale();

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id, status: "PLACED" },
    orderBy: { placedAt: "desc" },
    include: { items: true },
  });

  const euro = (cents: number) => "€" + (cents / 100).toFixed(2).replace(".", ",");
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        {t("backToRecipes")}
      </Link>
      <h1 className="mb-2 mt-3 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-stone-500">{t("subtitle")}</p>

      {orders.length === 0 ? (
        <p className="text-sm text-stone-400">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const total = order.items.reduce((s, i) => s + (i.priceCents ?? 0) * i.quantity, 0);
            const count = order.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={order.id} className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{fmtDate(order.placedAt)}</span>
                  <span className="text-sm text-stone-500">
                    {t("productCount", { count })}
                    {total ? ` · ${euro(total)}` : ""}
                  </span>
                </div>
                {order.recipeTitles.length || order.listTitles.length ? (
                  <p className="mt-1 text-xs text-stone-500">
                    {[...order.recipeTitles, ...order.listTitles.map((t) => `🛒 ${t}`)].join(" · ")}
                  </p>
                ) : null}
                <ul className="mt-3 space-y-1 text-sm text-stone-600">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {item.productName}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                      {item.priceCents != null ? (
                        <span className="flex-none text-stone-400">
                          {euro(item.priceCents * item.quantity)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {order.unavailableItems.length ? (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">{t("notAvailableTitle")}</p>
                    <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
                      {order.unavailableItems.map((line, i) => (
                        <li key={i} className="truncate">{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
