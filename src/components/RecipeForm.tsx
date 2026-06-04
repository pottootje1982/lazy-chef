"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";

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
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
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
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 text-sm text-brand-600 hover:underline">
        + Add {label.toLowerCase()}
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
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-6">
      {/* Carried through from the photo-scan importer; not user-editable. */}
      <input type="hidden" name="sourceImageUrl" defaultValue={initial.sourceImageUrl} />
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input id="title" name="title" defaultValue={initial.title} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="description">
            Description
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
              Servings
            </label>
            <input id="servings" name="servings" defaultValue={initial.servings} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="prepTime">
              Prep time
            </label>
            <input id="prepTime" name="prepTime" defaultValue={initial.prepTime} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cookTime">
              Cook time
            </label>
            <input id="cookTime" name="cookTime" defaultValue={initial.cookTime} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="imageUrl">
              Image URL
            </label>
            <input id="imageUrl" name="imageUrl" defaultValue={initial.imageUrl} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="sourceUrl">
              Source URL
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
          label="Ingredients"
          initial={initial.ingredients}
          placeholder="e.g. 200g cherry tomatoes"
        />
      </div>

      <div className="card p-5">
        <ListField
          name="instructions"
          label="Instructions"
          initial={initial.instructions}
          placeholder="Describe this step…"
          multiline
        />
      </div>

      <div className="card p-5">
        <ListField name="tags" label="Tags" initial={initial.tags} placeholder="e.g. vegetarian" />
      </div>

      <div className="flex gap-3">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
