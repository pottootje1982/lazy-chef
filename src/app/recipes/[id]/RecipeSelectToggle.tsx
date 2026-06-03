"use client";

import { useSelectionSet, SELECTED_RECIPES_KEY } from "@/lib/use-selection";

export default function RecipeSelectToggle({ recipeId }: { recipeId: string }) {
  const { has, toggle } = useSelectionSet(SELECTED_RECIPES_KEY);
  const selected = has(recipeId);
  return (
    <button
      type="button"
      onClick={() => toggle(recipeId)}
      aria-pressed={selected}
      className={selected ? "btn-primary" : "btn-secondary"}
    >
      {selected ? "✓ Selected for order" : "Select for order"}
    </button>
  );
}
