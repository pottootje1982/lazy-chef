"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { FormState } from "@/app/actions";
import { RECIPE_CATEGORIES } from "@/lib/categories";

export type RecipeFormValues = {
  title: string;
  description: string;
  imageUrl: string;
  sourceImageUrl: string;
  sourceUrl: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  categories: string[];
  origin: string;
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const tc = useTranslations("common");
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? tc("saving") : label}
    </button>
  );
}

// A repeatable list of text inputs (ingredients / instructions / tags).
function ListField({
  name,
  label,
  initial,
  placeholder,
  multiline,
}: {
  name: string;
  label: string;
  initial: string[];
  placeholder: string;
  multiline?: boolean;
}) {
  const t = useTranslations("recipeForm");
  const [items, setItems] = useState<string[]>(initial.length ? initial : [""]);

  const update = (i: number, value: string) =>
    setItems((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  const add = () => setItems((prev) => [...prev, ""]);
  const remove = (i: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [""]));

  return (
    <div>
      <span className="label">{label}</span>
      <div className="space-y-2">
        {items.map((value, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 w-5 text-right text-xs text-stone-400">{i + 1}.</span>
            {multiline ? (
              <textarea
                name={name}
                value={value}
                onChange={(e) => update(i, e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="input resize-y"
              />
            ) : (
              <input
                name={name}
                value={value}
                onChange={(e) => update(i, e.target.value)}
                placeholder={placeholder}
                className="input"
              />
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-1 px-2 text-stone-400 hover:text-red-500"
              aria-label={t("remove")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 text-sm text-brand-600 hover:underline">
        {t("addItem", { label: label.toLowerCase() })}
      </button>
    </div>
  );
}

export default function RecipeForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial: RecipeFormValues;
  submitLabel: string;
}) {
  const t = useTranslations("recipeForm");
  const tc = useTranslations("categories");
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Cmd/Ctrl-S saves the recipe (instead of the browser's "save page" dialog).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Carried through from the photo-scan importer; not user-editable. */}
      <input type="hidden" name="sourceImageUrl" defaultValue={initial.sourceImageUrl} />
      {/* Records how the recipe was created (manual/url/scan/paprika). */}
      <input type="hidden" name="origin" defaultValue={initial.origin} />
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">
            {t("title")}
          </label>
          <input id="title" name="title" defaultValue={initial.title} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="description">
            {t("description")}
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={initial.description}
            rows={2}
            className="input resize-y"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="servings">
              {t("servings")}
            </label>
            <input id="servings" name="servings" defaultValue={initial.servings} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="prepTime">
              {t("prepTime")}
            </label>
            <input id="prepTime" name="prepTime" defaultValue={initial.prepTime} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cookTime">
              {t("cookTime")}
            </label>
            <input id="cookTime" name="cookTime" defaultValue={initial.cookTime} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="imageUrl">
              {t("imageUrl")}
            </label>
            <input id="imageUrl" name="imageUrl" defaultValue={initial.imageUrl} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="sourceUrl">
              {t("sourceUrl")}
            </label>
            <input
              id="sourceUrl"
              name="sourceUrl"
              defaultValue={initial.sourceUrl}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <ListField
          name="ingredients"
          label={t("ingredients")}
          initial={initial.ingredients}
          placeholder={t("ingredientPlaceholder")}
        />
      </div>

      <div className="card p-5">
        <ListField
          name="instructions"
          label={t("instructions")}
          initial={initial.instructions}
          placeholder={t("instructionPlaceholder")}
          multiline
        />
      </div>

      <div className="card p-5">
        <span className="label">{t("categories")}</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {RECIPE_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="categories"
                value={c.key}
                defaultChecked={initial.categories.includes(c.key)}
                className="h-4 w-4 rounded border-stone-300"
              />
              {tc(c.key)}
            </label>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <ListField name="tags" label={t("tags")} initial={initial.tags} placeholder={t("tagPlaceholder")} />
      </div>

      <div className="flex gap-3">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
