"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { renameWeekPlan, deleteWeekPlan } from "@/lib/week-plan-actions";

export type WeekPlanCard = {
  id: string;
  name: string;
  recipeIds: string[];
  recipeTitles: string[];
  lastUsedLabel: string;
  everOrdered: boolean;
};

function PlanCard({ plan, readOnly }: { plan: WeekPlanCard; readOnly: boolean }) {
  const t = useTranslations("weekPlans");
  const [name, setName] = useState(plan.name);
  const orderHref = `/order?ids=${encodeURIComponent(plan.recipeIds.join(","))}&weekPlanId=${plan.id}`;

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {readOnly ? (
            <h2 className="font-semibold">{name}</h2>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== plan.name && renameWeekPlan(plan.id, name)}
              maxLength={200}
              aria-label={t("nameAria")}
              className="w-full rounded border border-transparent px-1 text-base font-semibold hover:border-stone-200 focus:border-brand-500 focus:outline-none"
            />
          )}
          <p className="mt-0.5 px-1 text-xs text-stone-400">
            {plan.everOrdered ? "" : "🆕 "}
            {plan.lastUsedLabel}
          </p>
        </div>
        {!readOnly ? (
          <button
            onClick={() => deleteWeekPlan(plan.id)}
            className="flex-none text-xs text-stone-400 hover:text-red-600"
          >
            {t("delete")}
          </button>
        ) : null}
      </div>

      <p className="mt-3 px-1 text-sm text-stone-600">
        {plan.recipeTitles.length ? plan.recipeTitles.join(" · ") : t("noRecipes")}
      </p>

      <div className="mt-4">
        {plan.recipeIds.length ? (
          <Link href={orderHref} className="btn-primary">
            {t("orderWithPicnic")}
          </Link>
        ) : (
          <span className="text-xs text-stone-400">{t("nothingToOrder")}</span>
        )}
      </div>
    </section>
  );
}

export default function WeekPlanList({
  plans,
  readOnly,
}: {
  plans: WeekPlanCard[];
  readOnly: boolean;
}) {
  return (
    <div className="space-y-5">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} readOnly={readOnly} />
      ))}
    </div>
  );
}
