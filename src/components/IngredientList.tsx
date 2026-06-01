"use client";

import Link from "next/link";
import { useState } from "react";

export type LinkedProduct = {
  mappingId: string;
  picnicId: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
};

export type IngredientItem = { raw: string; product: LinkedProduct | null };

type SearchProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  imageUrl: string | null;
};

function euro(cents: number | null): string | null {
  if (cents == null) return null;
  return "€" + (cents / 100).toFixed(2).replace(".", ",");
}

function Row({ item, picnicLinked }: { item: IngredientItem; picnicLinked: boolean }) {
  const [product, setProduct] = useState<LinkedProduct | null>(item.product);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""); // editable Picnic search term
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchProduct[]>([]);

  // body is { ingredient } for the auto search, or { ingredient, query } when
  // the user edits the search term and re-runs it.
  async function fetchProducts(body: { ingredient: string; query?: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/picnic/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "picnic_not_linked"
            ? "Connect your Picnic account in Settings first."
            : (data.error ?? "Search failed."),
        );
        return;
      }
      if (typeof data.translated === "string") setQuery(data.translated);
      setResults(data.products ?? []);
      setSearched(true);
    } catch {
      setError("Something went wrong searching Picnic.");
    } finally {
      setLoading(false);
    }
  }

  function openLinker() {
    setOpen(true);
    setError(null);
    setResults([]);
    setSearched(false);
    fetchProducts({ ingredient: item.raw }); // auto: normalize + translate
  }

  function manualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) fetchProducts({ ingredient: item.raw, query: query.trim() });
  }

  async function select(p: SearchProduct) {
    setBusyId(p.picnicId);
    setError(null);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawIngredient: item.raw, translated: query, product: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save mapping.");
        return;
      }
      setProduct({
        mappingId: data.mapping.id,
        picnicId: p.picnicId,
        name: p.name,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        unitQuantity: p.unitQuantity,
      });
      setOpen(false);
    } catch {
      setError("Could not save mapping.");
    } finally {
      setBusyId(null);
    }
  }

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

  return (
    <li className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <span className="mt-0.5 text-brand-500">•</span>
          <span className="text-sm">{item.raw}</span>
        </div>
        {product ? null : picnicLinked ? (
          <button
            onClick={openLinker}
            className="flex-none text-xs font-medium text-brand-600 hover:underline"
          >
            {open ? "Searching…" : "Link product"}
          </button>
        ) : (
          <Link
            href="/settings"
            className="flex-none text-xs font-medium text-stone-400 hover:text-brand-600"
          >
            Connect Picnic
          </Link>
        )}
      </div>

      {/* Linked product summary */}
      {product ? (
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
          <div className="flex flex-none gap-2">
            <button
              onClick={openLinker}
              className="text-xs text-stone-500 hover:text-brand-600"
            >
              Change
            </button>
            <button onClick={unlink} className="text-xs text-stone-500 hover:text-red-600">
              Unlink
            </button>
          </div>
        </div>
      ) : null}

      {/* Search panel */}
      {open ? (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-stone-500">Search Picnic — edit the term if needed</span>
            <button onClick={() => setOpen(false)} className="text-xs text-stone-400 hover:text-stone-700">
              Close
            </button>
          </div>

          <form onSubmit={manualSearch} className="mb-2 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dutch search term…"
              className="input !py-1.5 text-sm"
            />
            <button type="submit" disabled={loading} className="btn-secondary flex-none !py-1.5">
              {loading ? "…" : "Search"}
            </button>
          </form>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-sm text-stone-400">Loading products…</p> : null}
          {!loading && !error && searched && results.length === 0 ? (
            <p className="text-sm text-stone-400">
              No matching products found. Try editing the search term above.
            </p>
          ) : null}

          <div className="space-y-2">
            {results.map((p, i) => (
              <div key={`${p.picnicId}-${i}`} className="flex items-center gap-3 rounded border border-stone-100 p-2">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-10 w-10 flex-none rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 flex-none rounded bg-stone-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.name}</p>
                  <p className="text-xs text-stone-500">
                    {[p.unitQuantity, euro(p.priceCents)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => select(p)}
                  disabled={busyId === p.picnicId}
                  className="btn-primary flex-none !py-1 !px-3 text-xs"
                >
                  {busyId === p.picnicId ? "…" : "Select"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function IngredientList({
  items,
  picnicLinked,
}: {
  items: IngredientItem[];
  picnicLinked: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-400">No ingredients listed.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <Row key={i} item={item} picnicLinked={picnicLinked} />
      ))}
    </ul>
  );
}
