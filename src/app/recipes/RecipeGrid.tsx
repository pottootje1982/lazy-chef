"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  useSelectionSet,
  SELECTED_RECIPES_KEY,
  SELECTED_LISTS_KEY,
} from "@/lib/use-selection";
import { createWeekPlan } from "@/lib/week-plan-actions";

export type RecipeCard = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  origin: string | null;
  createdAt: string; // ISO
  lastOrderedAt: string | null; // ISO or null
};

const SCANNED_CHIP = "rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600";

export type GroceryListCard = {
  id: string;
  name: string;
  itemCount: number;
};

export type FilterChip = { key: string; label: string; href: string; active: boolean };

const chipClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-sm transition ${
    active ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
  }`;

type View = "grid" | "list";
type SortKey = "created" | "ordered";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const VIEW_KEY = "rm.recipeView";
const SORT_KEY = "rm.recipeSort";

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RecipeGrid({
  recipes,
  lists,
  catLabel,
  categoryChips,
  originChips,
  grocerName,
}: {
  recipes: RecipeCard[];
  lists: GroceryListCard[];
  catLabel: string;
  categoryChips: FilterChip[];
  originChips: FilterChip[];
  grocerName: string; // active grocer display name (e.g. "Picnic" / "Jumbo")
}) {
  const router = useRouter();
  const t = useTranslations("recipes");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { ids: recipeSel, toggle: toggleRecipe, clear: clearRecipes } =
    useSelectionSet(SELECTED_RECIPES_KEY);
  const { ids: listSel, toggle: toggleList, clear: clearLists } =
    useSelectionSet(SELECTED_LISTS_KEY);

  const [saving, setSaving] = useState(false);
  const [planName, setPlanName] = useState("");
  const [savingBusy, setSavingBusy] = useState(false);

  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>({ key: "created", dir: "desc" });
  const [query, setQuery] = useState("");

  // Filter-as-you-type over title + tags (substring, case-insensitive). This is
  // client-side: the full set is already loaded, so there's no round-trip.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [recipes, query]);

  // Load persisted view + sort preferences.
  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "grid" || v === "list") setView(v);
    try {
      const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? "");
      if ((s?.key === "created" || s?.key === "ordered") && (s?.dir === "asc" || s?.dir === "desc")) {
        setSort(s);
      }
    } catch {
      /* no stored sort */
    }
  }, []);

  function changeView(v: View) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }
  function toggleSort(key: SortKey) {
    setSort((prev) => {
      const next: Sort =
        prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" };
      localStorage.setItem(SORT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clear() {
    clearRecipes();
    clearLists();
  }

  function order() {
    const params = new URLSearchParams();
    if (recipeSel.size) params.set("ids", [...recipeSel].join(","));
    if (listSel.size) params.set("lists", [...listSel].join(","));
    if (![...params].length) return;
    router.push(`/order?${params.toString()}`);
  }

  // Default plan name = the selected recipe titles joined.
  function startSavePlan() {
    const titles = recipes.filter((r) => recipeSel.has(r.id)).map((r) => r.title);
    setPlanName(titles.join(" + ").slice(0, 200));
    setSaving(true);
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planName.trim() || savingBusy) return;
    setSavingBusy(true);
    try {
      await createWeekPlan(planName.trim(), [...recipeSel]);
      clearRecipes();
      setSaving(false);
      setPlanName("");
      router.push("/week-plans");
    } finally {
      setSavingBusy(false);
    }
  }

  // List view is client-sorted; grid keeps the server order (newest first).
  const sortedForList = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "created") {
        return a.createdAt < b.createdAt ? -dir : a.createdAt > b.createdAt ? dir : 0;
      }
      // "ordered": never-ordered (null) always sort last.
      if (a.lastOrderedAt === b.lastOrderedAt) return 0;
      if (a.lastOrderedAt === null) return 1;
      if (b.lastOrderedAt === null) return -1;
      return a.lastOrderedAt < b.lastOrderedAt ? -dir : dir;
    });
  }, [filtered, sort]);

  const totalSelected = recipeSel.size + listSel.size;
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      {/* Filter chips (category + origin) inline with the client-side search box */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {categoryChips.map((c) => (
          <Link key={c.key} href={c.href} className={chipClass(c.active)}>
            {c.label}
          </Link>
        ))}
        {originChips.length ? (
          <span className="mx-1 self-center text-stone-300" aria-hidden>
            |
          </span>
        ) : null}
        {originChips.map((o) => (
          <Link key={o.key} href={o.href} className={chipClass(o.active)}>
            {o.label}
          </Link>
        ))}
        {recipes.length > 0 ? (
          <div className="relative ml-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="input w-48 pr-8"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label={t("clearSearch")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Pinned recurring-grocery lists (not recipes). */}
      {lists.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
            {t("weeklyGroceries")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => {
              const isSelected = listSel.has(list.id);
              return (
                <div
                  key={list.id}
                  className={`card flex items-center gap-3 p-3 transition hover:shadow-md ${
                    isSelected ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleList(list.id)}
                    className="h-4 w-4 flex-none accent-brand-600"
                    title={t("selectForOrdering")}
                  />
                  <span className="text-xl">🛒</span>
                  <Link href="/groceries" className="min-w-0 flex-1">
                    <p className="truncate font-medium">{list.name}</p>
                    <p className="text-xs text-stone-500">
                      {t("productCount", { count: list.itemCount })}
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Result count / empty-state, reflecting the live client-side filter */}
      {recipes.length > 0 ? (
        <p className="mb-4 text-sm text-stone-500">
          {filtered.length === 0
            ? query
              ? t("noMatchQuery", { label: catLabel, query })
              : t("noMatchPlain", { label: catLabel })
            : query || catLabel
              ? t("countLabeled", { count: filtered.length, label: catLabel })
              : t("orderTip", { grocer: grocerName })}
        </p>
      ) : null}

      {/* View toggle */}
      {filtered.length > 0 ? (
        <div className="mb-4 flex justify-end">
          <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-sm">
            <button
              onClick={() => changeView("grid")}
              className={`px-3 py-1 ${view === "grid" ? "bg-brand-600 text-white" : "bg-white text-stone-600 hover:bg-stone-100"}`}
            >
              {t("grid")}
            </button>
            <button
              onClick={() => changeView("list")}
              className={`border-l border-stone-200 px-3 py-1 ${view === "list" ? "bg-brand-600 text-white" : "bg-white text-stone-600 hover:bg-stone-100"}`}
            >
              {t("list")}
            </button>
          </div>
        </div>
      ) : null}

      {view === "list" ? (
        <div>
          {/* Sortable header */}
          <div className="flex items-center gap-3 border-b border-stone-200 px-2 pb-2 text-xs font-medium text-stone-400">
            <span className="h-4 w-4 flex-none" />
            <span className="min-w-0 flex-1">{t("recipeColumn")}</span>
            <button
              onClick={() => toggleSort("created")}
              className="w-24 flex-none text-right hover:text-stone-700"
            >
              {t("createdColumn")}{arrow("created")}
            </button>
            <button
              onClick={() => toggleSort("ordered")}
              className="w-28 flex-none text-right hover:text-stone-700"
            >
              {t("lastOrderedColumn")}{arrow("ordered")}
            </button>
          </div>
          <ul className="divide-y divide-stone-100">
            {sortedForList.map((recipe) => {
              const isSelected = recipeSel.has(recipe.id);
              return (
                <li
                  key={recipe.id}
                  className={`flex items-center gap-3 px-2 py-2 ${isSelected ? "bg-brand-50" : "hover:bg-stone-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecipe(recipe.id)}
                    className="h-4 w-4 flex-none accent-brand-600"
                    title={t("selectForOrdering")}
                  />
                  <Link href={`/recipes/${recipe.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-600">
                    {recipe.title}
                  </Link>
                  {recipe.origin === "scan" ? (
                    <span className="flex-none" title={t("scannedTitle")}>
                      📷
                    </span>
                  ) : null}
                  <span className="w-24 flex-none text-right text-xs text-stone-500">
                    {fmtDate(recipe.createdAt, locale)}
                  </span>
                  <span className="w-28 flex-none text-right text-xs text-stone-500">
                    {recipe.lastOrderedAt ? fmtDate(recipe.lastOrderedAt, locale) : t("never")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => {
            const isSelected = recipeSel.has(recipe.id);
            return (
              <div
                key={recipe.id}
                className={`card relative overflow-hidden transition hover:shadow-md ${
                  isSelected ? "ring-2 ring-brand-500" : ""
                }`}
              >
                <label
                  className="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white/90 shadow-sm"
                  title={t("selectForOrdering")}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecipe(recipe.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                </label>

                <Link href={`/recipes/${recipe.id}`} className="block">
                  {recipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recipe.imageUrl} alt={recipe.title} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-stone-100 text-4xl">
                      🍽️
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="font-semibold leading-tight">{recipe.title}</h2>
                    {recipe.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-stone-500">{recipe.description}</p>
                    ) : null}
                    {recipe.origin === "scan" || recipe.tags.length ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {recipe.origin === "scan" ? (
                          <span className={SCANNED_CHIP}>{t("scanned")}</span>
                        ) : null}
                        {recipe.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky order bar, shown once anything is selected. */}
      {totalSelected > 0 ? (
        <div className="sticky bottom-4 mt-6 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          {saving ? (
            <form onSubmit={savePlan} className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                maxLength={200}
                placeholder={t("weekPlanName")}
                className="input min-w-0 flex-1 !py-1.5 text-sm"
              />
              <button type="submit" disabled={savingBusy} className="btn-primary flex-none">
                {savingBusy ? tCommon("saving") : t("savePlan")}
              </button>
              <button
                type="button"
                onClick={() => setSaving(false)}
                className="btn-secondary flex-none"
              >
                {tCommon("cancel")}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-stone-600">
                {t("selectedSummary", {
                  summary: [
                    recipeSel.size ? t("recipesSelected", { count: recipeSel.size }) : null,
                    listSel.size ? t("listsSelected", { count: listSel.size }) : null,
                  ]
                    .filter(Boolean)
                    .join(" + "),
                })}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={clear} className="btn-secondary">
                  {t("clear")}
                </button>
                {recipeSel.size > 0 ? (
                  <button onClick={startSavePlan} className="btn-secondary">
                    {t("saveAsWeekPlan")}
                  </button>
                ) : null}
                <button onClick={order} className="btn-primary">
                  {t("orderWithGrocer", { grocer: grocerName })}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
