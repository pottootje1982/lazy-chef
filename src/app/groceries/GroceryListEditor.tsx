"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  renameList,
  deleteList,
  addGroceryItem,
  removeGroceryItem,
  setGroceryItemQuantity,
} from "@/lib/grocery-actions";
import PicnicProductSearch from "@/components/PicnicProductSearch";
import AddToCartButton from "@/components/AddToCartButton";
import type { CartItem } from "@/lib/orders";

type Item = {
  id: string;
  picnicId: string;
  productName: string;
  imageId: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number;
};

// Map a grocery item to a draft-cart product snapshot.
function toCartItem(it: Item): CartItem {
  return {
    picnicId: it.picnicId,
    name: it.productName,
    imageId: it.imageId,
    priceCents: it.priceCents,
    unitQuantity: it.unitQuantity,
    quantity: it.quantity,
  };
}

function QtyStepper({ id, initial }: { id: string; initial: number }) {
  const t = useTranslations("groceries");
  const [qty, setQty] = useState(initial);
  function change(delta: number) {
    const next = Math.max(0, Math.min(99, qty + delta));
    if (next === qty) return;
    setQty(next);
    void setGroceryItemQuantity(id, next).catch(() => {});
  }
  return (
    <div className="flex flex-none items-center gap-1">
      <button
        onClick={() => change(-1)}
        disabled={qty <= 0}
        className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        aria-label={t("decreaseQuantity")}
      >
        −
      </button>
      <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
      <button
        onClick={() => change(1)}
        disabled={qty >= 99}
        className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        aria-label={t("increaseQuantity")}
      >
        +
      </button>
    </div>
  );
}

function euro(cents: number | null): string | null {
  return cents == null ? null : "€" + (cents / 100).toFixed(2).replace(".", ",");
}

export default function GroceryListEditor({
  list,
  picnicLinked,
}: {
  list: { id: string; name: string; items: Item[] };
  picnicLinked: boolean;
}) {
  const t = useTranslations("groceries");
  const [name, setName] = useState(list.name);
  const itemIds = new Set(list.items.map((i) => i.picnicId));

  // Collapsed by default; "0" in localStorage means the user expanded this list.
  const collapseKey = `rm.groceryCollapsed.${list.id}`;
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    if (localStorage.getItem(collapseKey) === "0") setCollapsed(false);
  }, [collapseKey]);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(collapseKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("expandList") : t("collapseList")}
            aria-expanded={!collapsed}
            className="flex-none text-stone-400 hover:text-stone-700"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${collapsed ? "" : "rotate-90"}`}
            >
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span>🛒</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== list.name && renameList(list.id, name)}
            className="min-w-0 rounded border border-transparent px-1 text-base font-semibold hover:border-stone-200 focus:border-brand-500 focus:outline-none"
          />
          <span className="flex-none text-xs text-stone-400">
            {t("productCount", { count: list.items.length })}
          </span>
        </div>
        <div className="flex flex-none items-center gap-3">
          {list.items.length > 0 ? (
            <AddToCartButton
              variant="labeled"
              label={t("addAllToCart")}
              items={list.items.map(toCartItem)}
            />
          ) : null}
          <button
            onClick={() => {
              if (confirm(t("deleteConfirm", { name, count: list.items.length }))) {
                deleteList(list.id);
              }
            }}
            className="text-xs text-stone-400 hover:text-red-600"
          >
            {t("deleteList")}
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <>
      {/* Add products via Picnic search */}
      {picnicLinked ? (
        <PicnicProductSearch
          placeholder={t("searchPlaceholder")}
          action={{
            label: t("add"),
            pickedLabel: t("added"),
            isPicked: (p) => itemIds.has(p.picnicId),
            onPick: async (p) => {
              await addGroceryItem(list.id, {
                picnicId: p.picnicId,
                name: p.name,
                imageId: p.imageId,
                priceCents: p.priceCents,
                unitQuantity: p.unitQuantity,
              });
            },
          }}
        />
      ) : null}

      {/* Items */}
      <ul className="mt-4 space-y-2 border-t border-stone-100 pt-4">
        {list.items.length === 0 ? (
          <li className="text-sm text-stone-400">{t("noProducts")}</li>
        ) : (
          list.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-lg bg-stone-50 p-2">
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt={it.productName} className="h-9 w-9 flex-none rounded object-cover" />
              ) : (
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded bg-stone-200 text-sm">
                  🛒
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.productName}</p>
                <p className="text-xs text-stone-500">
                  {[it.unitQuantity, euro(it.priceCents)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <QtyStepper id={it.id} initial={it.quantity} />
              <AddToCartButton items={[toCartItem(it)]} label={t("addToCart")} />
              <button
                onClick={() => removeGroceryItem(it.id)}
                className="flex-none px-2 text-stone-400 hover:text-red-600"
                aria-label={t("removeProduct")}
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>
        </>
      )}
    </section>
  );
}
