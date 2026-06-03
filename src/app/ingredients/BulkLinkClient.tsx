"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type UnlinkedItem = {
  key: string;
  raw: string;
  count: number;
  recipes: { id: string; title: string }[]; // recipes that use this ingredient
  words: string[]; // Dutch chip words
  prefill: string; // Dutch search term to prefill
};

type SearchProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  imageUrl: string | null;
};

function euro(cents: number | null): string | null {
  return cents == null ? null : "€" + (cents / 100).toFixed(2).replace(".", ",");
}

function Row({ item, onLinked }: { item: UnlinkedItem; onLinked: () => void }) {
  // Prefill the search box with the Dutch search term.
  const [query, setQuery] = useState(item.prefill || item.words.join(" "));
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linked, setLinked] = useState<{ name: string } | null>(null);

  async function search(body: { ingredient: string; query?: string }) {
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
        setError(data.error === "picnic_not_linked" ? "Connect Picnic first." : (data.error ?? "Search failed."));
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

  function searchWord(word: string) {
    setQuery(word);
    void search({ ingredient: item.raw, query: word });
  }
  function manualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) void search({ ingredient: item.raw, query: query.trim() });
  }

  async function link(p: SearchProduct) {
    setBusyId(p.picnicId);
    setError(null);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawIngredient: item.raw, translated: query || item.raw, product: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not link.");
        return;
      }
      setLinked({ name: p.name });
      onLinked();
    } catch {
      setError("Could not link.");
    } finally {
      setBusyId(null);
    }
  }

  if (linked) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
        <span className="text-green-600">✓</span>
        <span className="text-stone-500">{item.raw}</span>
        <span className="text-stone-400">→</span>
        <span className="font-medium text-green-800">{linked.name}</span>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-stone-200 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{item.raw}</span>
        <span className="text-xs text-stone-400">
          in{" "}
          {item.recipes.slice(0, 5).map((r, i) => (
            <span key={r.id}>
              {i > 0 ? ", " : ""}
              <Link
                href={`/recipes/${r.id}`}
                className="text-stone-500 hover:text-brand-600 hover:underline"
              >
                {r.title}
              </Link>
            </span>
          ))}
          {item.recipes.length > 5 ? ` +${item.recipes.length - 5} more` : ""}
        </span>
      </div>

      {/* Word chips + manual search */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.words.map((w) => (
          <button
            key={w}
            onClick={() => searchWord(w)}
            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700 hover:bg-brand-100 hover:text-brand-700"
          >
            {w}
          </button>
        ))}
        <form onSubmit={manualSearch} className="flex flex-1 gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search term…"
            className="input !py-1 text-sm"
          />
          <button type="submit" disabled={loading} className="btn-secondary flex-none !py-1">
            {loading ? "…" : "Search"}
          </button>
        </form>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {!loading && !error && searched && results.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">No products found — try another word.</p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-2 space-y-2">
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
                onClick={() => link(p)}
                disabled={busyId === p.picnicId}
                className="btn-primary flex-none !py-1 !px-3 text-xs"
              >
                {busyId === p.picnicId ? "…" : "Link"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export default function BulkLinkClient({ items }: { items: UnlinkedItem[] }) {
  const [linkedCount, setLinkedCount] = useState(0);
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return items;
    return items.filter((i) => i.raw.toLowerCase().includes(f) || i.key.includes(f));
  }, [items, filter]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-stone-500">
          {items.length} not linked
          {linkedCount > 0 ? <span className="ml-1 text-green-700">· {linkedCount} linked now</span> : null}
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter ingredients…"
          className="input max-w-xs !py-1.5 text-sm"
        />
      </div>

      <ul className="space-y-2">
        {shown.map((item) => (
          <Row key={item.key} item={item} onLinked={() => setLinkedCount((c) => c + 1)} />
        ))}
      </ul>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No ingredients match “{filter}”.</p>
      ) : null}
    </div>
  );
}
