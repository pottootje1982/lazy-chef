"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PicnicProductSearch from "@/components/PicnicProductSearch";
import {
  markIngredientUnavailable,
  markIngredientAvailable,
  setIngredientQuantity,
} from "@/lib/ingredient-actions";

export type LinkedProduct = {
  mappingId: string;
  picnicId: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
};

export type IngredientItem = {
  raw: string;
  ingredientKey: string; // normalized key, used to flag (un)available
  product: LinkedProduct | null;
  unavailable: boolean;
  quantity: number; // effective order qty (override ?? parsed)
  defaultQuantity: number; // parsed from the line
};

function euro(cents: number | null): string | null {
  if (cents == null) return null;
  return "€" + (cents / 100).toFixed(2).replace(".", ",");
}

// Compact per-ingredient order quantity (persisted as a per-recipe override).
// Number + tiny up/down arrows; also responds to the mouse wheel.
function QtySpinner({
  recipeId,
  ingredientKey,
  initial,
  defaultQuantity,
}: {
  recipeId: string;
  ingredientKey: string;
  initial: number;
  defaultQuantity: number;
}) {
  const [qty, setQty] = useState(initial);
  const qtyRef = useRef(initial);
  const ref = useRef<HTMLDivElement>(null);

  function bump(delta: number) {
    const next = Math.max(1, Math.min(99, qtyRef.current + delta));
    if (next === qtyRef.current) return;
    qtyRef.current = next;
    setQty(next);
    void setIngredientQuantity(recipeId, ingredientKey, next).catch(() => {});
  }

  // Scroll-to-change (non-passive so we can stop the page from scrolling).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      bump(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overridden = qty !== defaultQuantity;
  return (
    <div
      ref={ref}
      title={`Order quantity${overridden ? ` (recipe: ${defaultQuantity})` : ""} — scroll or use arrows`}
      className="flex flex-none items-center gap-0.5 rounded border border-stone-200 px-1 py-0.5"
    >
      <span className={`text-sm tabular-nums ${overridden ? "font-semibold text-brand-700" : "text-stone-700"}`}>
        ×{qty}
      </span>
      <span className="flex flex-col leading-none">
        <button
          onClick={() => bump(1)}
          disabled={qty >= 99}
          className="text-[9px] text-stone-400 hover:text-stone-700 disabled:opacity-30"
          aria-label="Increase quantity"
        >
          ▲
        </button>
        <button
          onClick={() => bump(-1)}
          disabled={qty <= 1}
          className="text-[9px] text-stone-400 hover:text-stone-700 disabled:opacity-30"
          aria-label="Decrease quantity"
        >
          ▼
        </button>
      </span>
    </div>
  );
}

function Row({
  item,
  picnicLinked,
  readOnly,
  lang,
  recipeId,
}: {
  item: IngredientItem;
  picnicLinked: boolean;
  readOnly: boolean;
  lang?: string;
  recipeId: string;
}) {
  const [product, setProduct] = useState<LinkedProduct | null>(item.product);
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(item.unavailable);

  async function unlink() {
    if (!product) return;
    const prev = product;
    setProduct(null);
    try {
      await fetch(`/api/mappings/${prev.mappingId}`, { method: "DELETE" });
    } catch {
      setProduct(prev); // restore on failure
    }
  }

  async function setUnavail(next: boolean) {
    setUnavailable(next); // optimistic
    if (next) setOpen(false);
    try {
      if (next) await markIngredientUnavailable(item.ingredientKey);
      else await markIngredientAvailable(item.ingredientKey);
    } catch {
      setUnavailable(!next); // revert on failure
    }
  }

  return (
    <li
      className={`rounded-lg border p-3 ${
        unavailable ? "border-amber-300 bg-amber-50" : "border-stone-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <span className="mt-0.5 text-brand-500">•</span>
          <span className="text-sm">{item.raw}</span>
        </div>
        {readOnly ? null : (
          <div className="flex flex-none items-center gap-3">
            {unavailable ? (
              <button
                onClick={() => setUnavail(false)}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                Mark available
              </button>
            ) : (
              <>
                {product ? null : picnicLinked ? (
                  <button
                    onClick={() => setOpen(true)}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    {open ? "Searching…" : "Link product"}
                  </button>
                ) : (
                  <Link
                    href="/settings"
                    className="text-xs font-medium text-stone-400 hover:text-brand-600"
                  >
                    Connect Picnic
                  </Link>
                )}
                <button
                  onClick={() => setUnavail(true)}
                  className="text-xs text-stone-400 hover:text-amber-700"
                >
                  Not available
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {unavailable ? (
        <p className="mt-2 text-xs text-amber-700">🛒 Not available at the grocer — buy elsewhere.</p>
      ) : null}

      {/* Linked product summary */}
      {!unavailable && product ? (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-stone-50 p-2">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-12 w-12 flex-none rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded bg-stone-200 text-lg">
              🛒
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-xs text-stone-500">
              {[product.unitQuantity, euro(product.priceCents)].filter(Boolean).join(" · ")}
            </p>
          </div>
          {readOnly ? null : (
            <>
              <QtySpinner
                recipeId={recipeId}
                ingredientKey={item.ingredientKey}
                initial={item.quantity}
                defaultQuantity={item.defaultQuantity}
              />
              <div className="flex flex-none flex-col gap-1">
                <button
                  onClick={() => setOpen(true)}
                  className="text-xs text-stone-500 hover:text-brand-600"
                >
                  Change
                </button>
                <button onClick={unlink} className="text-xs text-stone-500 hover:text-red-600">
                  Unlink
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Search panel */}
      {open ? (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-stone-500">Search Picnic — edit the term if needed</span>
            <button onClick={() => setOpen(false)} className="text-xs text-stone-400 hover:text-stone-700">
              Close
            </button>
          </div>

          <PicnicProductSearch
            ingredient={item.raw}
            autoSearch
            lang={lang}
            action={{
              label: "Select",
              onPick: async (p, query) => {
                const res = await fetch("/api/mappings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rawIngredient: item.raw, translated: query, product: p }),
                });
                const data = await res.json();
                if (!res.ok) return data.error ?? "Could not save mapping.";
                setProduct({
                  mappingId: data.mapping.id,
                  picnicId: p.picnicId,
                  name: p.name,
                  imageUrl: p.imageUrl,
                  priceCents: p.priceCents,
                  unitQuantity: p.unitQuantity,
                });
                setOpen(false);
              },
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

export default function IngredientList({
  items,
  picnicLinked,
  readOnly = false,
  lang,
  recipeId,
}: {
  items: IngredientItem[];
  picnicLinked: boolean;
  readOnly?: boolean;
  lang?: string;
  recipeId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-400">No ingredients listed.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <Row
          key={i}
          item={item}
          picnicLinked={picnicLinked}
          readOnly={readOnly}
          lang={lang}
          recipeId={recipeId}
        />
      ))}
    </ul>
  );
}
