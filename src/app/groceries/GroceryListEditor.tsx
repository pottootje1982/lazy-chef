"use client";

import { useState } from "react";
import {
  renameList,
  deleteList,
  addGroceryItem,
  removeGroceryItem,
  setGroceryItemQuantity,
} from "@/lib/grocery-actions";
import PicnicProductSearch from "@/components/PicnicProductSearch";

type Item = {
  id: string;
  picnicId: string;
  productName: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number;
};

function QtyStepper({ id, initial }: { id: string; initial: number }) {
  const [qty, setQty] = useState(initial);
  function change(delta: number) {
    const next = Math.max(1, Math.min(99, qty + delta));
    if (next === qty) return;
    setQty(next);
    void setGroceryItemQuantity(id, next).catch(() => {});
  }
  return (
    <div className="flex flex-none items-center gap-1">
      <button
        onClick={() => change(-1)}
        disabled={qty <= 1}
        className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
      <button
        onClick={() => change(1)}
        disabled={qty >= 99}
        className="flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        aria-label="Increase quantity"
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
  const [name, setName] = useState(list.name);
  const itemIds = new Set(list.items.map((i) => i.picnicId));

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>🛒</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== list.name && renameList(list.id, name)}
            className="rounded border border-transparent px-1 text-base font-semibold hover:border-stone-200 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => deleteList(list.id)}
          className="flex-none text-xs text-stone-400 hover:text-red-600"
        >
          Delete list
        </button>
      </div>

      {/* Add products via Picnic search */}
      {picnicLinked ? (
        <PicnicProductSearch
          placeholder="Search Picnic products to add…"
          action={{
            label: "Add",
            pickedLabel: "Added",
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
          <li className="text-sm text-stone-400">No products yet — search above to add some.</li>
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
              <button
                onClick={() => removeGroceryItem(it.id)}
                className="flex-none px-2 text-stone-400 hover:text-red-600"
                aria-label="Remove product"
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
