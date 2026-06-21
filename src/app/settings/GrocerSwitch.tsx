"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setActiveGrocer } from "@/lib/user-actions";

const OPTIONS = ["picnic", "ah"] as const;

export default function GrocerSwitch({ active }: { active: string }) {
  const t = useTranslations("grocer");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(value: string) {
    if (value === active || pending) return;
    startTransition(async () => {
      await setActiveGrocer(value);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-sm">
      {OPTIONS.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => choose(o)}
          disabled={pending}
          aria-pressed={active === o}
          className={`px-4 py-1.5 transition ${i > 0 ? "border-l border-stone-200" : ""} ${
            active === o
              ? "bg-brand-600 text-white"
              : "bg-white text-stone-600 hover:bg-stone-100"
          } disabled:opacity-50`}
        >
          {t(o)}
        </button>
      ))}
    </div>
  );
}
