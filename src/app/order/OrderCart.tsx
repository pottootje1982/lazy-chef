"use client";

import Link from "next/link";
import { useState } from "react";
import { saveOrderSelection, placeCurrentOrder } from "@/lib/order-actions";

export type OrderItem = {
  picnicId: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number; // how many of the selected recipes use this product
  isStaple: boolean;
};

function euro(cents: number): string {
  return "€" + (cents / 100).toFixed(2).replace(".", ",");
}

export default function OrderCart({
  items,
  initialSelectedIds,
  unmappedCount,
  picnicLinked,
  isGuest = false,
}: {
  items: OrderItem[];
  initialSelectedIds: string[];
  unmappedCount: number;
  picnicLinked: boolean;
  isGuest?: boolean;
}) {
  const ids = new Set(items.map((i) => i.picnicId));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds.filter((id) => ids.has(id))),
  );
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    // Autosave the selection to the draft order (non-guests only).
    if (!isGuest) void saveOrderSelection([...next]).catch(() => {});
  }

  const chosen = items.filter((i) => selected.has(i.picnicId));
  const totalProducts = chosen.reduce((s, i) => s + i.quantity, 0);
  const totalCents = chosen.reduce((s, i) => s + (i.priceCents ?? 0) * i.quantity, 0);

  async function addToCart() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/picnic/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: chosen.map((i) => ({ picnicId: i.picnicId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "picnic_not_linked"
            ? "Connect your Picnic account in Settings first."
            : (data.error ?? "Could not add to cart."),
        );
        setStatus("idle");
        return;
      }
      // Record the placed order so it shows under Settings → Previous orders.
      await placeCurrentOrder().catch(() => {});
      setStatus("done");
    } catch {
      setError("Something went wrong adding to your Picnic cart.");
      setStatus("idle");
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 card p-5 text-sm text-stone-500">
        None of these ingredients are linked to a Picnic product yet.
        {unmappedCount > 0 ? " Open a recipe to link products to ingredients." : ""}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Shopping list</h2>
        <span className="text-xs text-stone-400">Untick anything you don&apos;t need</span>
      </div>

      <ul className="card divide-y divide-stone-100">
        {items.map((item) => {
          const isOn = selected.has(item.picnicId);
          const reason = item.isStaple
            ? "pantry staple"
            : item.quantity > 1
              ? `in ${item.quantity} recipes`
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
                <p className="truncate text-sm font-medium">
                  {item.name}
                  {item.quantity > 1 ? (
                    <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                      ×{item.quantity}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-stone-500">
                  {[item.unitQuantity, item.priceCents != null ? euro(item.priceCents) : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {!isOn && reason ? <span className="ml-1 text-stone-400">· {reason}</span> : null}
                </p>
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
              ✓ Added {totalProducts} product{totalProducts === 1 ? "" : "s"} to your Picnic cart.
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              <a
                href="https://picnic.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 underline hover:text-green-900"
              >
                Open Picnic to check out →
              </a>
              <Link href="/settings" className="text-green-700 underline hover:text-green-900">
                View in previous orders
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
                  {chosen.length} of {items.length} selected
                </span>
                {totalCents ? <> · ~{euro(totalCents)}</> : null}
              </div>

              {isGuest ? (
                <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
                  Sign in to order with Picnic
                </span>
              ) : picnicLinked ? (
                <button
                  onClick={addToCart}
                  disabled={status === "loading" || chosen.length === 0}
                  className="btn-primary"
                >
                  {status === "loading" ? "Adding…" : `Add ${chosen.length} to Picnic cart`}
                </button>
              ) : (
                <Link href="/settings" className="btn-primary">
                  Connect Picnic to order
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
