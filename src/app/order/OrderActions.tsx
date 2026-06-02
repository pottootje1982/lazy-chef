"use client";

import Link from "next/link";
import { useState } from "react";

export type CartItem = {
  picnicId: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  quantity: number;
};

function euro(cents: number): string {
  return "€" + (cents / 100).toFixed(2).replace(".", ",");
}

export default function OrderActions({
  items,
  totalProducts,
  totalCents,
  unmappedCount,
  picnicLinked,
}: {
  items: CartItem[];
  totalProducts: number;
  totalCents: number;
  unmappedCount: number;
  picnicLinked: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function addToCart() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/picnic/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ picnicId: i.picnicId, quantity: i.quantity })),
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
      setStatus("done");
    } catch {
      setError("Something went wrong adding to your Picnic cart.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-lg">
        <p className="text-sm font-medium text-green-800">
          ✓ Added {totalProducts} product{totalProducts === 1 ? "" : "s"} to your Picnic cart.
        </p>
        <a
          href="https://picnic.app"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm text-green-700 underline hover:text-green-900"
        >
          Open Picnic to choose a delivery slot and check out →
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-stone-600">
          <span className="font-medium text-stone-900">
            {totalProducts} product{totalProducts === 1 ? "" : "s"}
          </span>
          {totalCents ? <> · ~{euro(totalCents)}</> : null}
          {unmappedCount > 0 ? (
            <span className="ml-1 text-amber-700">({unmappedCount} not linked, skipped)</span>
          ) : null}
        </div>

        {picnicLinked ? (
          <button
            onClick={addToCart}
            disabled={status === "loading" || items.length === 0}
            className="btn-primary"
          >
            {status === "loading" ? "Adding…" : "Add to Picnic cart"}
          </button>
        ) : (
          <Link href="/settings" className="btn-primary">
            Connect Picnic to order
          </Link>
        )}
      </div>
    </div>
  );
}
