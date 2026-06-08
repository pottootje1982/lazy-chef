"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addPantryKeyword,
  removePantryKeyword,
  setProductStaple,
} from "@/lib/pantry-actions";

export type PantryMapping = {
  picnicId: string;
  ingredientKey: string;
  productName: string;
  isStaple: boolean | null;
};

type PantryProduct = {
  picnicId: string;
  productName: string;
  ingredientKeys: string;
  isStaple: boolean | null;
};

// Collapse mappings to one row per product (a product may be linked from
// several ingredient keys); overrides apply to the whole product.
function dedupeByProduct(mappings: PantryMapping[]): PantryProduct[] {
  const byId = new Map<string, PantryProduct>();
  for (const m of mappings) {
    const cur = byId.get(m.picnicId);
    if (cur) {
      cur.ingredientKeys += " " + m.ingredientKey;
      if (cur.isStaple == null && m.isStaple != null) cur.isStaple = m.isStaple;
    } else {
      byId.set(m.picnicId, {
        picnicId: m.picnicId,
        productName: m.productName,
        ingredientKeys: m.ingredientKey,
        isStaple: m.isStaple,
      });
    }
  }
  return [...byId.values()];
}

function OverrideButtons({
  value,
  onSet,
}: {
  value: boolean | null;
  onSet: (v: boolean | null) => void;
}) {
  const t = useTranslations("pantry");
  const opts: { label: string; v: boolean | null }[] = [
    { label: t("auto"), v: null },
    { label: t("pantry"), v: true },
    { label: t("notPantry"), v: false },
  ];
  return (
    <div className="flex flex-none gap-1">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.label}
            onClick={() => onSet(o.v)}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              active
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PantrySettings({
  keywords,
  mappings,
}: {
  keywords: string[];
  mappings: PantryMapping[];
}) {
  const t = useTranslations("pantry");
  const products = useMemo(() => dedupeByProduct(mappings), [mappings]);

  const [query, setQuery] = useState("");
  // Local override state so toggles reflect immediately (and persist server-side).
  const [overrides, setOverrides] = useState<Record<string, boolean | null>>(() => {
    const m: Record<string, boolean | null> = {};
    for (const x of products) m[x.picnicId] = x.isStaple;
    return m;
  });

  function setOverride(picnicId: string, v: boolean | null) {
    setOverrides((prev) => ({ ...prev, [picnicId]: v }));
    void setProductStaple(picnicId, v).catch(() => {});
  }

  const overridden = useMemo(
    () => products.filter((m) => overrides[m.picnicId] != null),
    [products, overrides],
  );

  const matches = useMemo(() => {
    const f = query.trim().toLowerCase();
    if (!f) return [];
    return products
      .filter(
        (m) =>
          m.productName.toLowerCase().includes(f) || m.ingredientKeys.includes(f),
      )
      .slice(0, 25);
  }, [products, query]);

  return (
    <div className="space-y-6">
      {/* Keyword rules */}
      <div>
        <h3 className="text-sm font-medium text-stone-700">{t("keywordsHeading")}</h3>
        <p className="mt-1 text-xs text-stone-500">{t("keywordsDesc")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <span className="text-sm text-stone-400">{t("noKeywords")}</span>
          ) : (
            keywords.map((w) => (
              <span
                key={w}
                className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm text-stone-700"
              >
                {w}
                <button
                  onClick={() => removePantryKeyword(w)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-red-600"
                  aria-label={t("removeAria", { word: w })}
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>
        <form action={addPantryKeyword} className="mt-3 flex gap-2">
          <input
            name="keyword"
            required
            maxLength={40}
            placeholder={t("addPlaceholder")}
            className="input !py-1.5 text-sm"
          />
          <button type="submit" className="btn-secondary flex-none !py-1.5">
            {t("add")}
          </button>
        </form>
      </div>

      {/* Per-product overrides */}
      <div className="border-t border-stone-100 pt-5">
        <h3 className="text-sm font-medium text-stone-700">{t("overridesHeading")}</h3>
        <p className="mt-1 text-xs text-stone-500">{t("overridesDesc")}</p>

        {overridden.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {overridden.map((m) => (
              <li
                key={m.picnicId}
                className="flex items-center gap-3 rounded-lg bg-stone-50 p-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{m.productName}</span>
                <OverrideButtons
                  value={overrides[m.picnicId]}
                  onSet={(v) => setOverride(m.picnicId, v)}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {mappings.length > 0 ? (
          <div className="mt-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="input !py-1.5 text-sm"
            />
            {matches.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {matches.map((m) => (
                  <li
                    key={m.picnicId}
                    className="flex items-center gap-3 rounded border border-stone-100 p-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {m.productName}
                    </span>
                    <OverrideButtons
                      value={overrides[m.picnicId]}
                      onSet={(v) => setOverride(m.picnicId, v)}
                    />
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <p className="mt-2 text-sm text-stone-400">{t("noMatchingProducts")}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-400">{t("linkFirst")}</p>
        )}
      </div>
    </div>
  );
}
