"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { removeDraftCartItem } from "@/lib/order-actions";

// The "Added items" breakdown on the order page: products added via basket
// buttons, each removable. Quantities are adjusted in the shopping list below.
export default function DraftCartSection({
  title,
  items,
}: {
  title: string;
  items: { picnicId: string; name: string }[];
}) {
  const t = useTranslations("order");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(picnicId: string) {
    startTransition(async () => {
      await removeDraftCartItem(picnicId);
      router.refresh();
    });
  }

  return (
    <section className="mt-6 card p-4">
      <h2 className="mb-2 font-semibold">🛒 {title}</h2>
      <ul className="space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.picnicId} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 gap-2">
              <span className="text-brand-500">•</span>
              <span className="truncate text-stone-700">{it.name}</span>
            </span>
            <button
              onClick={() => remove(it.picnicId)}
              disabled={pending}
              aria-label={t("removeFromCart")}
              className="flex-none px-2 text-stone-400 hover:text-red-600 disabled:opacity-50"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
