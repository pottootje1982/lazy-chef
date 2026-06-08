"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Item = { uid: string; name: string; sourceUrl: string; alreadyImported: boolean };

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function PaprikaImportClient() {
  const t = useTranslations("paprikaImport");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);

  const newItems = (items ?? []).filter((i) => !i.alreadyImported);

  async function load() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/paprika/recipes");
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "paprika_not_connected"
            ? t("notConnected")
            : (data.error ?? t("loadFailed")),
        );
        return;
      }
      setItems(data.items);
      setImportedCount(data.importedCount);
      // Pre-select all new recipes by default.
      setSelected(new Set(data.items.filter((i: Item) => !i.alreadyImported).map((i: Item) => i.uid)));
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function runImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/paprika/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("importFailed"));
        return;
      }
      setDone({ imported: data.imported, skipped: data.skipped });
      setItems(null);
      setSelected(new Set());
    } catch {
      setError(t("importError"));
    } finally {
      setImporting(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6">
        <p className="text-sm font-medium text-green-800">
          {t("importedDone", { count: done.imported })}
        </p>
        <div className="mt-3 flex gap-3">
          <Link href="/recipes" className="btn-primary">
            {t("viewMyRecipes")}
          </Link>
          <button onClick={load} className="btn-secondary">
            {t("loadAgain")}
          </button>
        </div>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="card p-6">
        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <p className="mb-4 text-sm text-stone-500">{t("fetchHint")}</p>
        <button onClick={load} disabled={loading} className="btn-primary">
          {loading ? t("loading") : t("loadRecipes")}
        </button>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-stone-500">
          {t("countLine", { newCount: newItems.length, importedCount })}
        </span>
        {newItems.length > 0 ? (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setSelected(new Set(newItems.map((i) => i.uid)))}
              className="text-brand-600 hover:underline"
            >
              {t("selectAll")}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-stone-500 hover:underline"
            >
              {t("clear")}
            </button>
          </div>
        ) : null}
      </div>

      {newItems.length === 0 ? (
        <div className="card p-6 text-sm text-stone-500">{t("allImported")}</div>
      ) : (
        <ul className="card divide-y divide-stone-100">
          {newItems.map((i) => (
            <li key={i.uid} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={selected.has(i.uid)}
                onChange={() => toggle(i.uid)}
                className="h-4 w-4 flex-none accent-brand-600"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.name}</p>
                {i.sourceUrl ? (
                  <p className="truncate text-xs text-stone-400">{host(i.sourceUrl)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-4 mt-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          <span className="text-sm text-stone-600">
            {t("selectedCount", { count: selected.size })}
          </span>
          <button
            onClick={runImport}
            disabled={importing || selected.size === 0}
            className="btn-primary"
          >
            {importing ? t("importing") : t("importN", { count: selected.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
