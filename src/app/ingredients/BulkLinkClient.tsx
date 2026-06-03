"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ignoreIngredient,
  unignoreIngredient,
  unlinkIngredient,
  markIngredientUnavailable,
  markIngredientAvailable,
} from "@/lib/ingredient-actions";
import PicnicProductSearch, { type SearchProduct } from "@/components/PicnicProductSearch";

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

// Same shape as IgnoredItem; an ingredient that can't be bought at the grocer.
export type NotAvailableItem = IgnoredItem;

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

type View = "all" | "unlinked" | "linked" | "ignored" | "unavailable";
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
        <PicnicProductSearch
          ingredient={item.raw}
          initialQuery={item.product.name}
          action={{
            label: "Link",
            onPick: async (p, query) => {
              const res = await fetch("/api/mappings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawIngredient: item.raw, translated: query || item.raw, product: p }),
              });
              if (!res.ok) return (await res.json()).error ?? "Could not link.";
              onChanged(p);
              setEditing(false);
            },
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

function NotAvailableRow({
  item,
  onMarkAvailable,
}: {
  item: NotAvailableItem;
  onMarkAvailable: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <span className="flex-none text-amber-500" title="Buy elsewhere">🛒</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-amber-900">{item.raw}</span>
          <RecipeLinks recipes={item.recipes} />
        </div>
      </div>
      <button
        onClick={onMarkAvailable}
        className="flex-none rounded-full bg-amber-200 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-300"
      >
        Mark available
      </button>
    </li>
  );
}

function Row({
  item,
  onLinked,
  onIgnore,
  onNotAvailable,
}: {
  item: UnlinkedItem;
  onLinked: (p: SearchProduct) => void;
  onIgnore: () => void;
  onNotAvailable: () => void;
}) {
  return (
    <li className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-baseline gap-2">
        <div className="flex flex-1 flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{item.raw}</span>
          <RecipeLinks recipes={item.recipes} />
        </div>
        <button
          onClick={onNotAvailable}
          title="Can't be bought at the grocer — buy elsewhere"
          className="flex-none text-xs text-stone-400 hover:text-amber-700"
        >
          Not available
        </button>
        <button
          onClick={onIgnore}
          title="Hide this junk line"
          className="flex-none text-xs text-stone-400 hover:text-red-600"
        >
          Ignore
        </button>
      </div>

      <PicnicProductSearch
        ingredient={item.raw}
        words={item.words}
        initialQuery={item.prefill || item.words.join(" ")}
        action={{
          label: "Link",
          onPick: async (p, query) => {
            const res = await fetch("/api/mappings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawIngredient: item.raw, translated: query || item.raw, product: p }),
            });
            if (!res.ok) return (await res.json()).error ?? "Could not link.";
            onLinked(p);
          },
        }}
      />
    </li>
  );
}

export default function BulkLinkClient({
  unlinked,
  linked,
  ignored,
  unavailable,
}: {
  unlinked: UnlinkedItem[];
  linked: LinkedItem[];
  ignored: IgnoredItem[];
  unavailable: NotAvailableItem[];
}) {
  const [view, setView] = useState<View>("all");
  const [filter, setFilter] = useState("");
  // Live session moves: dismissed keys drop out of the unlinked list; the other
  // lists collect items linked/ignored this session (or restored via un-ignore).
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [sessionLinked, setSessionLinked] = useState<LinkedItem[]>([]);
  const [sessionIgnored, setSessionIgnored] = useState<IgnoredItem[]>([]);
  const [serverIgnoredHidden, setServerIgnoredHidden] = useState<Set<string>>(() => new Set());
  const [sessionUnavailable, setSessionUnavailable] = useState<NotAvailableItem[]>([]);
  const [serverUnavailableHidden, setServerUnavailableHidden] = useState<Set<string>>(() => new Set());
  const [restoredUnlinked, setRestoredUnlinked] = useState<UnlinkedItem[]>([]);
  // Linked items unlinked this session, and per-key product overrides from "Change".
  const [linkedHidden, setLinkedHidden] = useState<Set<string>>(() => new Set());
  const [changedProducts, setChangedProducts] = useState<Record<string, LinkedProduct>>({});

  const originalUnlinkedKeys = useMemo(() => new Set(unlinked.map((i) => i.key)), [unlinked]);

  // Load the persisted filter selection.
  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "all" || v === "unlinked" || v === "linked" || v === "ignored" || v === "unavailable") {
      setView(v);
    }
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

  function handleMarkUnavailable(item: UnlinkedItem) {
    setDismissed((prev) => new Set(prev).add(item.key));
    setSessionUnavailable((prev) => [
      { key: item.key, raw: item.raw, count: item.count, recipes: item.recipes },
      ...prev,
    ]);
    void markIngredientUnavailable(item.key).catch(() => {});
  }

  function handleMarkAvailable(item: NotAvailableItem) {
    setSessionUnavailable((prev) => prev.filter((x) => x.key !== item.key));
    setServerUnavailableHidden((prev) => new Set(prev).add(item.key));
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
    void markIngredientAvailable(item.key).catch(() => {});
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
  const unavailableAll = useMemo(
    () =>
      [...sessionUnavailable, ...unavailable.filter((i) => !serverUnavailableHidden.has(i.key))].sort(
        (a, b) => a.raw.localeCompare(b.raw),
      ),
    [unavailable, sessionUnavailable, serverUnavailableHidden],
  );

  const unlinkedShown = unlinkedAll.filter((i) => matches(i.raw, i.key));
  const linkedShown = linkedAll.filter((i) => matches(i.raw, i.key, i.product.name));
  const ignoredShown = ignoredAll.filter((i) => matches(i.raw, i.key));
  const unavailableShown = unavailableAll.filter((i) => matches(i.raw, i.key));

  const chips: { v: View; label: string; n: number }[] = [
    { v: "all", label: "All", n: unlinkedAll.length + linkedAll.length },
    { v: "unlinked", label: "Unlinked", n: unlinkedAll.length },
    { v: "linked", label: "Linked", n: linkedAll.length },
    { v: "unavailable", label: "Not available", n: unavailableAll.length },
    { v: "ignored", label: "Ignored", n: ignoredAll.length },
  ];

  const showUnlinked = view === "all" || view === "unlinked";
  const showLinked = view === "all" || view === "linked";
  const showIgnored = view === "ignored";
  const showUnavailable = view === "unavailable";

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
                onNotAvailable={() => handleMarkUnavailable(item)}
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

      {showUnavailable ? (
        <section>
          <p className="mb-2 text-sm text-stone-500">
            These can&apos;t be bought at the grocer — buy them elsewhere. They appear on each
            order that uses them.
          </p>
          <ul className="space-y-2">
            {unavailableShown.map((item) => (
              <NotAvailableRow
                key={item.key}
                item={item}
                onMarkAvailable={() => handleMarkAvailable(item)}
              />
            ))}
          </ul>
          {unavailableShown.length === 0 ? (
            <p className="py-4 text-sm text-stone-400">
              {unavailableAll.length === 0
                ? "Nothing flagged. Use “Not available” on an ingredient that the grocer doesn’t sell."
                : `No items match “${filter}”.`}
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
