"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLanguage } from "@/lib/user-actions";

const OPTIONS = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
] as const;

export default function LanguageSettings() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(value: string) {
    if (value === locale || pending) return;
    startTransition(async () => {
      await setLanguage(value);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-sm">
      {OPTIONS.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          disabled={pending}
          aria-pressed={locale === o.value}
          className={`px-4 py-1.5 transition ${i > 0 ? "border-l border-stone-200" : ""} ${
            locale === o.value
              ? "bg-brand-600 text-white"
              : "bg-white text-stone-600 hover:bg-stone-100"
          } disabled:opacity-50`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
