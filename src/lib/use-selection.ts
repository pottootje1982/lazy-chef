"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Recipe/grocery-list "selected for ordering" state, persisted in localStorage
// so it survives navigation (e.g. opening a recipe and coming back) and is
// shared live across components on the page.

export const SELECTED_RECIPES_KEY = "rm.selectedRecipes";
export const SELECTED_LISTS_KEY = "rm.selectedLists";

const EVENT = "rm-selection-change";

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // sync across tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function snapshot(key: string): string {
  return typeof window === "undefined" ? "[]" : localStorage.getItem(key) ?? "[]";
}

export function useSelectionSet(key: string) {
  // getSnapshot returns the raw JSON string (a stable value) so React's Object.is
  // check doesn't loop; we parse into a Set in a memo.
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => "[]",
  );

  const ids = useMemo<Set<string>>(() => {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch {
      return new Set();
    }
  }, [raw]);

  const persist = useCallback(
    (next: Set<string>) => {
      localStorage.setItem(key, JSON.stringify([...next]));
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
    },
    [ids, persist],
  );

  const clear = useCallback(() => persist(new Set()), [persist]);

  return { ids, has: (id: string) => ids.has(id), toggle, clear };
}
