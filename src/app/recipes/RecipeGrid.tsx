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

export default function RecipeGrid({ recipes }: { recipes: RecipeCard[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function order() {
    if (selected.size === 0) return;
    router.push(`/order?ids=${[...selected].join(",")}`);
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => {
          const isSelected = selected.has(recipe.id);
          return (
            <div
              key={recipe.id}
              className={`card relative overflow-hidden transition hover:shadow-md ${
                isSelected ? "ring-2 ring-brand-500" : ""
              }`}
            >
              {/* Selection checkbox overlay (kept above the link). */}
              <label
                className="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white/90 shadow-sm"
                title="Select for ordering"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(recipe.id)}
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

      {/* Sticky order bar, shown once at least one recipe is selected. */}
      {selected.size > 0 ? (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          <span className="text-sm text-stone-600">
            {selected.size} recipe{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set())} className="btn-secondary">
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
