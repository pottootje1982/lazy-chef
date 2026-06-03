"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ignoreIngredient,
  unignoreIngredient,
  unlinkIngredient,
} from "@/lib/ingredient-actions";
import ProductHoverCard from "@/components/ProductHoverCard";

export type UnlinkedItem = {
  key: string;
  raw: string;
  count: number;
  recipes: { id: string; title: string }[]; // recipes that use this ingredient
  words: string[]; // Dutch chip words
  prefill: string; // Dutch search term to prefill
};

export type IgnoredItem = {
  key: string;
  raw: string;
  count: number;
  recipes: { id: string; title: string }[];
};

type LinkedProduct = {
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
};

export type LinkedItem = {
  key: string;
  raw: string;
  count: number;
  recipes: { id: string; title: string }[];
  product: LinkedProduct;
};

type SearchProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  imageUrl: string | null;
};

type View = "all" | "unlinked" | "linked" | "ignored";
const VIEW_KEY = "rm.ingredientFilter";

function euro(cents: number | null): string | null {
  return cents == null ? null : "€" + (cents / 100).toFixed(2).replace(".", ",");
}

function RecipeLinks({ recipes }: { recipes: { id: string; title: string }[] }) {
  return (
    <span className="text-xs text-stone-400">
      in{" "}
      {recipes.slice(0, 5).map((r, i) => (
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
      {recipes.length > 5 ? ` +${recipes.length - 5} more` : ""}
    </span>
  );
}

// Shared search box + word chips + result list with a "Link" button. Used by
// both the unlinked Row and the linked row's "Change" mode.
function ProductSearch({
  rawIngredient,
  words,
  initialQuery,
  onLinked,
}: {
  rawIngredient: string;
  words: string[];
  initialQuery: string;
  onLinked: (p: SearchProduct) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visible, setVisible] = useState(8);

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
      setVisible(8);
      setSearched(true);
    } catch {
      setError("Something went wrong searching Picnic.");
    } finally {
      setLoading(false);
    }
  }

  function searchWord(word: string) {
    setQuery(word);
    void search({ ingredient: rawIngredient, query: word });
  }
  function manualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) void search({ ingredient: rawIngredient, query: query.trim() });
  }

  async function link(p: SearchProduct) {
    setBusyId(p.picnicId);
    setError(null);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawIngredient, translated: query || rawIngredient, product: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not link.");
        return;
      }
      onLinked(p);
    } catch {
      setError("Could not link.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {words.map((w) => (
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
          {results.slice(0, visible).map((p, i) => (
            <ProductHoverCard
              key={`${p.picnicId}-${i}`}
              product={p}
              className="flex items-center gap-3 rounded border border-stone-100 p-2"
            >
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
            </ProductHoverCard>
          ))}
          {results.length > visible ? (
            <button
              onClick={() => setVisible((v) => v + 8)}
              className="w-full rounded border border-stone-200 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
            >
              Load more ({results.length - visible})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LinkedRow({
  item,
  onUnlink,
  onChanged,
}: {
  item: LinkedItem;
  onUnlink: () => void;
  onChanged: (p: SearchProduct) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-lg border border-green-200 bg-green-50/60 p-3">
      <div className="flex items-center gap-3">
        {item.product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.product.imageUrl} alt={item.product.name} className="h-10 w-10 flex-none rounded object-cover" />
        ) : (
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-stone-100">🛒</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{item.raw}</span>
            <RecipeLinks recipes={item.recipes} />
          </div>
          <p className="truncate text-xs text-green-800">
            <span className="text-green-600">✓</span> {item.product.name}
            {[item.product.unitQuantity, euro(item.product.priceCents)].filter(Boolean).length ? (
              <span className="text-stone-500">
                {" · "}
                {[item.product.unitQuantity, euro(item.product.priceCents)].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-none gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-stone-500 hover:text-brand-600"
          >
            {editing ? "Close" : "Change"}
          </button>
          <button onClick={onUnlink} className="text-xs text-stone-400 hover:text-red-600">
            Unlink
          </button>
        </div>
      </div>
      {editing ? (
        <ProductSearch
          rawIngredient={item.raw}
          words={[]}
          initialQuery={item.product.name}
          onLinked={(p) => {
            onChanged(p);
            setEditing(false);
          }}
        />
      ) : null}
    </li>
  );
}

function IgnoredRow({ item, onUnignore }: { item: IgnoredItem; onUnignore: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm text-stone-500 line-through">{item.raw}</span>
          <RecipeLinks recipes={item.recipes} />
        </div>
      </div>
      <button
        onClick={onUnignore}
        className="flex-none rounded-full bg-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-300"
      >
        Un-ignore
      </button>
    </li>
  );
}

function Row({
  item,
  onLinked,
  onIgnore,
}: {
  item: UnlinkedItem;
  onLinked: (p: SearchProduct) => void;
  onIgnore: () => void;
}) {
  return (
    <li className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-baseline gap-2">
        <div className="flex flex-1 flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{item.raw}</span>
          <RecipeLinks recipes={item.recipes} />
        </div>
        <button
          onClick={onIgnore}
          title="Hide this junk line"
          className="flex-none text-xs text-stone-400 hover:text-red-600"
        >
          Ignore
        </button>
      </div>

      <ProductSearch
        rawIngredient={item.raw}
        words={item.words}
        initialQuery={item.prefill || item.words.join(" ")}
        onLinked={onLinked}
      />
    </li>
  );
}

export default function BulkLinkClient({
  unlinked,
  linked,
  ignored,
}: {
  unlinked: UnlinkedItem[];
  linked: LinkedItem[];
  ignored: IgnoredItem[];
}) {
  const [view, setView] = useState<View>("all");
  const [filter, setFilter] = useState("");
  // Live session moves: dismissed keys drop out of the unlinked list; the other
  // lists collect items linked/ignored this session (or restored via un-ignore).
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [sessionLinked, setSessionLinked] = useState<LinkedItem[]>([]);
  const [sessionIgnored, setSessionIgnored] = useState<IgnoredItem[]>([]);
  const [serverIgnoredHidden, setServerIgnoredHidden] = useState<Set<string>>(() => new Set());
  const [restoredUnlinked, setRestoredUnlinked] = useState<UnlinkedItem[]>([]);
  // Linked items unlinked this session, and per-key product overrides from "Change".
  const [linkedHidden, setLinkedHidden] = useState<Set<string>>(() => new Set());
  const [changedProducts, setChangedProducts] = useState<Record<string, LinkedProduct>>({});

  const originalUnlinkedKeys = useMemo(() => new Set(unlinked.map((i) => i.key)), [unlinked]);

  // Load the persisted filter selection.
  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "all" || v === "unlinked" || v === "linked" || v === "ignored") setView(v);
  }, []);

  function changeView(v: View) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  function handleLinked(item: UnlinkedItem, p: SearchProduct) {
    setDismissed((prev) => new Set(prev).add(item.key));
    setSessionLinked((prev) => [
      {
        key: item.key,
        raw: item.raw,
        count: item.count,
        recipes: item.recipes,
        product: {
          name: p.name,
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          unitQuantity: p.unitQuantity,
        },
      },
      ...prev,
    ]);
  }

  function handleUnlink(item: LinkedItem) {
    // Remove from the linked view…
    setSessionLinked((prev) => prev.filter((x) => x.key !== item.key));
    setLinkedHidden((prev) => new Set(prev).add(item.key));
    setChangedProducts((prev) => {
      const { [item.key]: _drop, ...rest } = prev;
      return rest;
    });
    // …and put it back under unlinked.
    if (originalUnlinkedKeys.has(item.key)) {
      setDismissed((prev) => {
        const n = new Set(prev);
        n.delete(item.key);
        return n;
      });
    } else {
      setRestoredUnlinked((prev) => [
        { key: item.key, raw: item.raw, count: item.count, recipes: item.recipes, words: [], prefill: "" },
        ...prev,
      ]);
    }
    void unlinkIngredient(item.key).catch(() => {});
  }

  function handleChangedProduct(item: LinkedItem, p: SearchProduct) {
    // The /api/mappings POST already upserted; reflect the new product in place.
    setChangedProducts((prev) => ({
      ...prev,
      [item.key]: {
        name: p.name,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        unitQuantity: p.unitQuantity,
      },
    }));
  }

  function handleIgnore(item: UnlinkedItem) {
    setDismissed((prev) => new Set(prev).add(item.key));
    setSessionIgnored((prev) => [
      { key: item.key, raw: item.raw, count: item.count, recipes: item.recipes },
      ...prev,
    ]);
    void ignoreIngredient(item.key).catch(() => {});
  }

  function handleUnignore(item: IgnoredItem) {
    setSessionIgnored((prev) => prev.filter((x) => x.key !== item.key));
    setServerIgnoredHidden((prev) => new Set(prev).add(item.key));
    if (originalUnlinkedKeys.has(item.key)) {
      // It was unlinked before being ignored — just un-dismiss it.
      setDismissed((prev) => {
        const n = new Set(prev);
        n.delete(item.key);
        return n;
      });
    } else {
      // A previously-saved ignored line: restore it to unlinked (no Dutch prefill).
      setRestoredUnlinked((prev) => [
        { key: item.key, raw: item.raw, count: item.count, recipes: item.recipes, words: [], prefill: "" },
        ...prev,
      ]);
    }
    void unignoreIngredient(item.key).catch(() => {});
  }

  const f = filter.trim().toLowerCase();
  // Match the typed filter against any of the given fields (ingredient line,
  // normalized key, and — for linked rows — the Picnic product name).
  const matches = (...fields: (string | undefined)[]) =>
    !f || fields.some((s) => s?.toLowerCase().includes(f));

  const unlinkedAll = useMemo(
    () => [...unlinked, ...restoredUnlinked].filter((i) => !dismissed.has(i.key)),
    [unlinked, restoredUnlinked, dismissed],
  );
  const linkedAll = useMemo(
    () =>
      [...sessionLinked, ...linked]
        .filter((i) => !linkedHidden.has(i.key))
        .map((i) => (changedProducts[i.key] ? { ...i, product: changedProducts[i.key] } : i))
        .sort((a, b) => a.raw.localeCompare(b.raw)),
    [linked, sessionLinked, linkedHidden, changedProducts],
  );
  const ignoredAll = useMemo(
    () =>
      [...sessionIgnored, ...ignored.filter((i) => !serverIgnoredHidden.has(i.key))].sort((a, b) =>
        a.raw.localeCompare(b.raw),
      ),
    [ignored, sessionIgnored, serverIgnoredHidden],
  );

  const unlinkedShown = unlinkedAll.filter((i) => matches(i.raw, i.key));
  const linkedShown = linkedAll.filter((i) => matches(i.raw, i.key, i.product.name));
  const ignoredShown = ignoredAll.filter((i) => matches(i.raw, i.key));

  const chips: { v: View; label: string; n: number }[] = [
    { v: "all", label: "All", n: unlinkedAll.length + linkedAll.length },
    { v: "unlinked", label: "Unlinked", n: unlinkedAll.length },
    { v: "linked", label: "Linked", n: linkedAll.length },
    { v: "ignored", label: "Ignored", n: ignoredAll.length },
  ];

  const showUnlinked = view === "all" || view === "unlinked";
  const showLinked = view === "all" || view === "linked";
  const showIgnored = view === "ignored";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.v}
              onClick={() => changeView(c.v)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                view === c.v
                  ? "bg-brand-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {c.label} <span className="tabular-nums opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter ingredients or products…"
          className="input max-w-xs !py-1.5 text-sm"
        />
      </div>

      {showUnlinked ? (
        <section>
          {view === "all" ? (
            <h2 className="mb-2 text-sm font-semibold text-stone-500">Unlinked</h2>
          ) : null}
          <ul className="space-y-2">
            {unlinkedShown.map((item) => (
              <Row
                key={item.key}
                item={item}
                onLinked={(p) => handleLinked(item, p)}
                onIgnore={() => handleIgnore(item)}
              />
            ))}
          </ul>
          {unlinkedShown.length === 0 ? (
            <p className="py-4 text-sm text-stone-400">
              {unlinkedAll.length === 0 ? "🎉 Everything is linked." : `No unlinked ingredients match “${filter}”.`}
            </p>
          ) : null}
        </section>
      ) : null}

      {showLinked ? (
        <section className={showUnlinked ? "mt-6" : ""}>
          {view === "all" ? (
            <h2 className="mb-2 text-sm font-semibold text-stone-500">Linked</h2>
          ) : null}
          <ul className="space-y-2">
            {linkedShown.map((item) => (
              <LinkedRow
                key={item.key}
                item={item}
                onUnlink={() => handleUnlink(item)}
                onChanged={(p) => handleChangedProduct(item, p)}
              />
            ))}
          </ul>
          {linkedShown.length === 0 ? (
            <p className="py-4 text-sm text-stone-400">
              {linkedAll.length === 0 ? "No linked ingredients yet." : `No linked ingredients match “${filter}”.`}
            </p>
          ) : null}
        </section>
      ) : null}

      {showIgnored ? (
        <section>
          <ul className="space-y-2">
            {ignoredShown.map((item) => (
              <IgnoredRow key={item.key} item={item} onUnignore={() => handleUnignore(item)} />
            ))}
          </ul>
          {ignoredShown.length === 0 ? (
            <p className="py-4 text-sm text-stone-400">
              {ignoredAll.length === 0
                ? "Nothing ignored. Use “Ignore” on a junk line to hide it here."
                : `No ignored ingredients match “${filter}”.`}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
