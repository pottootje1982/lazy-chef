"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type RecipeCard = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
};

export type GroceryListCard = {
  id: string;
  name: string;
  itemCount: number;
};

export default function RecipeGrid({
  recipes,
  lists,
}: {
  recipes: RecipeCard[];
  lists: GroceryListCard[];
}) {
  const router = useRouter();
  const [recipeSel, setRecipeSel] = useState<Set<string>>(new Set());
  const [listSel, setListSel] = useState<Set<string>>(new Set());

  function toggle(setter: typeof setRecipeSel, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    setRecipeSel(new Set());
    setListSel(new Set());
  }

  function order() {
    const params = new URLSearchParams();
    if (recipeSel.size) params.set("ids", [...recipeSel].join(","));
    if (listSel.size) params.set("lists", [...listSel].join(","));
    if (![...params].length) return;
    router.push(`/order?${params.toString()}`);
  }

  const totalSelected = recipeSel.size + listSel.size;

  return (
    <div>
      {/* Pinned recurring-grocery lists (not recipes). */}
      {lists.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
            Weekly groceries
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
                    onChange={() => toggle(setListSel, list.id)}
                    className="h-4 w-4 flex-none accent-brand-600"
                    title="Select for ordering"
                  />
                  <span className="text-xl">🛒</span>
                  <Link href="/groceries" className="min-w-0 flex-1">
                    <p className="truncate font-medium">{list.name}</p>
                    <p className="text-xs text-stone-500">
                      {list.itemCount} product{list.itemCount === 1 ? "" : "s"}
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => {
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
                title="Select for ordering"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(setRecipeSel, recipe.id)}
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
                  {recipe.tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-1">
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

      {/* Sticky order bar, shown once anything is selected. */}
      {totalSelected > 0 ? (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          <span className="text-sm text-stone-600">
            {[
              recipeSel.size ? `${recipeSel.size} recipe${recipeSel.size > 1 ? "s" : ""}` : null,
              listSel.size ? `${listSel.size} list${listSel.size > 1 ? "s" : ""}` : null,
            ]
              .filter(Boolean)
              .join(" + ")}{" "}
            selected
          </span>
          <div className="flex gap-2">
            <button onClick={clear} className="btn-secondary">
              Clear
            </button>
            <button onClick={order} className="btn-primary">
              Order with Picnic →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
