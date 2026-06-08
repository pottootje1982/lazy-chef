"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createRecipe } from "@/app/actions";
import RecipeForm, { type RecipeFormValues } from "@/components/RecipeForm";
import { classify } from "@/lib/categories";

export default function ImportClient() {
  const t = useTranslations("import");
  const tErr = useTranslations("errors");
  const tForm = useTranslations("recipeForm");
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
        setError(data.error ?? tErr("importFailed"));
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
        origin: "url",
      };
      setScraped(values);
      setPartial(values.ingredients.length === 0 && values.instructions.length === 0);
    } catch {
      setError(tErr("fetchPageFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (scraped) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {partial ? t("partial") : t("imported")}
          <button
            onClick={() => setScraped(null)}
            className="ml-2 text-green-700 underline hover:text-green-900"
          >
            {t("importDifferentUrl")}
          </button>
        </div>
        <RecipeForm action={createRecipe} initial={scraped} submitLabel={tForm("save")} />
      </div>
    );
  }

  return (
    <form onSubmit={handleImport} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="url">
          {t("urlLabel")}
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("urlPlaceholder")}
          className="input"
        />
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? t("fetching") : t("importButton")}
      </button>
    </form>
  );
}
