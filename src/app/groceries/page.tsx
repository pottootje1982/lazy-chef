import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productImageUrl } from "@/lib/picnic";
import { createList } from "@/lib/grocery-actions";
import GroceryListEditor from "./GroceryListEditor";

function euro(cents: number | null): string | null {
  return cents == null ? null : "€" + (cents / 100).toFixed(2).replace(".", ",");
}

export default async function GroceriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);
  const t = await getTranslations("groceries");

  const [user, lists] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { picnicAuthKey: true } }),
    prisma.groceryList.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { productName: "asc" } } },
    }),
  ]);
  const picnicLinked = Boolean(user?.picnicAuthKey);

  async function addList(formData: FormData) {
    "use server";
    await createList(String(formData.get("name") ?? ""));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("subtitle")}</p>

      {!isGuest ? (
        <form action={addList} className="mt-5 flex gap-2">
          <input
            name="name"
            required
            maxLength={100}
            placeholder={t("newListPlaceholder")}
            className="input"
          />
          <button className="btn-primary flex-none">{t("createList")}</button>
        </form>
      ) : null}

      {!isGuest && !picnicLinked ? (
        <p className="mt-3 text-sm text-stone-500">
          <Link href="/settings" className="text-brand-600 hover:underline">
            {t("connectPicnic")}
          </Link>{" "}
          {t("connectHint")}
        </p>
      ) : null}

      <div className="mt-6 space-y-5">
        {lists.length === 0 ? (
          <div className="card p-8 text-center text-sm text-stone-500">
            {t("noLists")}{isGuest ? "" : t("noListsCreate")}
          </div>
        ) : (
          lists.map((list) => {
            const items = list.items.map((it) => ({
              id: it.id,
              picnicId: it.picnicId,
              productName: it.productName,
              imageId: it.imageId,
              imageUrl: productImageUrl(it.imageId),
              priceCents: it.priceCents,
              unitQuantity: it.unitQuantity,
              quantity: it.quantity,
            }));
            return isGuest ? (
              <section key={list.id} className="card p-5">
                <h2 className="font-semibold">🛒 {list.name}</h2>
                <ul className="mt-3 space-y-1 text-sm text-stone-600">
                  {items.length === 0 ? (
                    <li className="text-stone-400">{t("noProductsGuest")}</li>
                  ) : (
                    items.map((it) => (
                      <li key={it.id} className="flex justify-between gap-3">
                        <span className="truncate">
                          {it.productName}
                          {it.quantity > 1 ? (
                            <span className="ml-1 text-stone-400">×{it.quantity}</span>
                          ) : null}
                        </span>
                        <span className="flex-none text-stone-400">
                          {[it.unitQuantity, euro(it.priceCents)].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            ) : (
              <GroceryListEditor
                key={list.id}
                list={{ id: list.id, name: list.name, items }}
                picnicLinked={picnicLinked}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
