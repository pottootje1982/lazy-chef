"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveOrderSelection, saveOrderQuantities, placeCurrentOrder } from "@/lib/order-actions";

export type OrderItem = {
  picnicId: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number; // computed amount to order (countable amounts / list quantities)
  recipeCount: number; // how many recipes reference this product
  isStaple: boolean;
};

function euro(cents: number): string {
  return "€" + (cents / 100).toFixed(2).replace(".", ",");
}

export default function OrderCart({
  items,
  initialSelectedIds,
  initialQuantities = {},
  unmappedCount,
  picnicLinked,
  isGuest = false,
}: {
  items: OrderItem[];
  initialSelectedIds: string[];
  initialQuantities?: Record<string, number>;
  unmappedCount: number;
  picnicLinked: boolean;
  isGuest?: boolean;
}) {
  const t = useTranslations("order");
  const tErr = useTranslations("errors");
  const ids = new Set(items.map((i) => i.picnicId));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds.filter((id) => ids.has(id))),
  );
  // Computed amount per product (countable amounts / list quantities).
  const computed = new Map(items.map((i) => [i.picnicId, i.quantity]));
  // User overrides only — unchanged items keep using the fresh computed amount.
  const [overrides, setOverrides] = useState<Record<string, number>>(
    () => ({ ...initialQuantities }),
  );
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const qtyOf = (id: string) => overrides[id] ?? computed.get(id) ?? 1;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    // Autosave the selection to the draft order (non-guests only).
    if (!isGuest) void saveOrderSelection([...next]).catch(() => {});
  }

  function setQty(id: string, delta: number) {
    setOverrides((prev) => {
      const current = prev[id] ?? computed.get(id) ?? 1;
      const next = { ...prev, [id]: Math.max(1, Math.min(99, current + delta)) };
      if (!isGuest) void saveOrderQuantities(next).catch(() => {});
      return next;
    });
  }

  const chosen = items.filter((i) => selected.has(i.picnicId));
  const totalProducts = chosen.reduce((s, i) => s + qtyOf(i.picnicId), 0);
  const totalCents = chosen.reduce((s, i) => s + (i.priceCents ?? 0) * qtyOf(i.picnicId), 0);

  async function addToCart() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/picnic/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: chosen.map((i) => ({ picnicId: i.picnicId, quantity: qtyOf(i.picnicId) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "picnic_not_linked"
            ? tErr("picnicNotLinked")
            : (data.error ?? tErr("addToCartFailed")),
        );
        setStatus("idle");
        return;
      }
      // Record the placed order so it shows under Settings → Previous orders.
      await placeCurrentOrder().catch(() => {});
      setStatus("done");
    } catch {
      setError(t("addToCartError"));
      setStatus("idle");
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 card p-5 text-sm text-stone-500">
        {t("noneLinked")}
        {unmappedCount > 0 ? t("openRecipeHint") : ""}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{t("shoppingList")}</h2>
        <span className="text-xs text-stone-400">{t("untickHint")}</span>
      </div>

      <ul className="card divide-y divide-stone-100">
        {items.map((item) => {
          const isOn = selected.has(item.picnicId);
          const qty = qtyOf(item.picnicId);
          const reason = item.isStaple
            ? t("reasonStaple")
            : item.recipeCount > 1
              ? t("reasonRecipes", { count: item.recipeCount })
              : null;
          return (
            <li key={item.picnicId} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => toggle(item.picnicId)}
                className="h-4 w-4 flex-none accent-brand-600"
              />
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className={`h-10 w-10 flex-none rounded object-cover ${isOn ? "" : "opacity-40"}`}
                />
              ) : (
                <div
                  className={`flex h-10 w-10 flex-none items-center justify-center rounded bg-stone-100 ${isOn ? "" : "opacity-40"}`}
                >
                  🛒
                </div>
              )}
              <div className={`min-w-0 flex-1 ${isOn ? "" : "text-stone-400"}`}>
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {[item.unitQuantity, item.priceCents != null ? euro(item.priceCents) : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {reason ? <span className="ml-1 text-stone-400">· {reason}</span> : null}
                </p>
              </div>
              {/* Quantity stepper */}
              <div className="flex flex-none items-center gap-1">
                <button
                  onClick={() => setQty(item.picnicId, -1)}
                  disabled={qty <= 1}
                  className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                  aria-label={t("decreaseQuantity")}
                >
                  −
                </button>
                <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty(item.picnicId, 1)}
                  disabled={qty >= 99}
                  className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                  aria-label={t("increaseQuantity")}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky action bar. */}
      <div className="sticky bottom-4 mt-4">
        {status === "done" ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-lg">
            <p className="text-sm font-medium text-green-800">
              {t("added", { count: totalProducts })}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              <a
                href="https://picnic.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 underline hover:text-green-900"
              >
                {t("openPicnic")}
              </a>
              <Link href="/settings" className="text-green-700 underline hover:text-green-900">
                {t("viewInPrevious")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
            {error ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-stone-600">
                <span className="font-medium text-stone-900">
                  {t("selectedCount", { chosen: chosen.length, total: items.length })}
                </span>
                {totalCents ? <> · ~{euro(totalCents)}</> : null}
              </div>

              {isGuest ? (
                <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
                  {t("signInToOrder")}
                </span>
              ) : picnicLinked ? (
                <button
                  onClick={addToCart}
                  disabled={status === "loading" || chosen.length === 0}
                  className="btn-primary"
                >
                  {status === "loading" ? t("adding") : t("addToCart", { count: chosen.length })}
                </button>
              ) : (
                <Link href="/settings" className="btn-primary">
                  {t("connectToOrder")}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
