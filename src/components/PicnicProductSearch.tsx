"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ProductHoverCard from "@/components/ProductHoverCard";

export type SearchProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  imageUrl: string | null;
};

// The per-result action a consumer injects (Add to list / Link / Select…).
export type ProductAction = {
  label: string;
  // Returns an error string to show inline, or void/undefined on success.
  onPick: (product: SearchProduct, query: string) => Promise<string | void>;
  isPicked?: (product: SearchProduct) => boolean;
  pickedLabel?: string;
};

function euro(cents: number | null): string | null {
  return cents == null ? null : "€" + (cents / 100).toFixed(2).replace(".", ",");
}

// Shared Picnic product search used by Weekly groceries, Link ingredients, and
// the recipe-details ingredient linker. Owns search/results/load-more/hover; the
// consumer supplies the per-result action.
export default function PicnicProductSearch({
  ingredient,
  words = [],
  initialQuery = "",
  placeholder,
  autoSearch = false,
  lang,
  action,
}: {
  ingredient?: string;
  words?: string[];
  initialQuery?: string;
  placeholder?: string;
  autoSearch?: boolean;
  lang?: string; // "en" → translate the ingredient to Dutch before searching
  action: ProductAction;
}) {
  const t = useTranslations("common");
  const tErr = useTranslations("errors");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visible, setVisible] = useState(8);

  async function runSearch(q?: string) {
    setLoading(true);
    setError(null);
    try {
      // Ingredient mode → {ingredient, query?} (server normalizes + translates).
      // Plain mode → {query} verbatim.
      const body = ingredient
        ? { ingredient, ...(lang ? { lang } : {}), ...(q ? { query: q } : {}) }
        : { query: (q ?? query).trim() };
      const res = await fetch("/api/picnic/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "picnic_not_linked"
            ? tErr("picnicNotLinked")
            : (data.error ?? tErr("searchFailed")),
        );
        return;
      }
      if (typeof data.translated === "string") setQuery(data.translated);
      setResults(data.products ?? []);
      setVisible(8);
      setSearched(true);
    } catch {
      setError(tErr("somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  // Auto-search on mount (e.g. recipe-details "Link product" panel, or the
  // "Change" panel which prefills the original Dutch search term). When an
  // initialQuery is given, search it verbatim; otherwise translate the ingredient.
  useEffect(() => {
    if (autoSearch) void runSearch(initialQuery || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function searchWord(word: string) {
    setQuery(word);
    void runSearch(word);
  }
  function manualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) void runSearch(query.trim());
  }

  async function pick(p: SearchProduct) {
    setBusyId(p.picnicId);
    setError(null);
    try {
      const err = await action.onPick(p, query);
      if (err) setError(err);
    } catch {
      setError("Something went wrong.");
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
            placeholder={placeholder ?? t("searchTermPlaceholder")}
            className="input !py-1 text-sm"
          />
          <button type="submit" disabled={loading} className="btn-secondary flex-none !py-1">
            {loading ? "…" : t("search")}
          </button>
        </form>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {!loading && !error && searched && results.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">{tErr("noProductsFound")}</p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-2 space-y-2">
          {results.slice(0, visible).map((p, i) => {
            const picked = action.isPicked?.(p) ?? false;
            return (
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
                  onClick={() => pick(p)}
                  disabled={picked || busyId === p.picnicId}
                  className="btn-primary flex-none !py-1 !px-3 text-xs"
                >
                  {picked ? (action.pickedLabel ?? "Added") : busyId === p.picnicId ? "…" : action.label}
                </button>
              </ProductHoverCard>
            );
          })}
          {results.length > visible ? (
            <button
              onClick={() => setVisible((v) => v + 8)}
              className="w-full rounded border border-stone-200 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
            >
              {t("loadMore", { count: results.length - visible })}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
