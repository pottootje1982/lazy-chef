"use client";

import { useState } from "react";
import { createRecipe } from "@/app/actions";
import RecipeForm, { type RecipeFormValues } from "@/components/RecipeForm";
import { classify } from "@/lib/categories";

export default function ImportClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<RecipeFormValues | null>(null);
  const [partial, setPartial] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import recipe.");
        return;
      }
      const r = data.recipe;
      const values: RecipeFormValues = {
        title: r.title ?? "",
        description: r.description ?? "",
        imageUrl: r.imageUrl ?? "",
        sourceImageUrl: "",
        sourceUrl: r.sourceUrl ?? url,
        servings: r.servings ?? "",
        prepTime: r.prepTime ?? "",
        cookTime: r.cookTime ?? "",
        ingredients: r.ingredients ?? [],
        instructions: r.instructions ?? [],
        tags: r.tags ?? [],
        // Suggest categories from the scraped title + ingredients (editable).
        categories: classify(r.title ?? "", r.ingredients ?? []),
      };
      setScraped(values);
      setPartial(values.ingredients.length === 0 && values.instructions.length === 0);
    } catch {
      setError("Something went wrong fetching that page.");
    } finally {
      setLoading(false);
    }
  }

  if (scraped) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {partial ? (
            <>
              We found the page but couldn&apos;t extract structured recipe data. We&apos;ve filled
              in what we could — please add the ingredients and steps below.
            </>
          ) : (
            <>Imported! Review the details below and save.</>
          )}
          <button
            onClick={() => setScraped(null)}
            className="ml-2 text-green-700 underline hover:text-green-900"
          >
            Import a different URL
          </button>
        </div>
        <RecipeForm action={createRecipe} initial={scraped} submitLabel="Save recipe" />
      </div>
    );
  }

  return (
    <form onSubmit={handleImport} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="url">
          Recipe URL
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.bbcgoodfood.com/recipes/…"
          className="input"
        />
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Fetching…" : "Import recipe"}
      </button>
    </form>
  );
}
