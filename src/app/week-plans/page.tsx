import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asGrocer } from "@/lib/grocer";
import WeekPlanList, { type WeekPlanCard } from "./WeekPlanList";

type Translator = (key: string, values?: Record<string, number>) => string;

function lastUsedLabel(d: Date | null, t: Translator): string {
  if (!d) return t("neverOrdered");
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return t("lastToday");
  if (days === 1) return t("lastYesterday");
  if (days < 7) return t("lastDays", { days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("lastWeeks", { weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("lastMonths", { months });
  const years = Math.floor(days / 365);
  return t("lastYears", { years });
}

export default async function WeekPlansPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);
  const t = await getTranslations("weekPlans");

  const [plans, recipes, me] = await Promise.all([
    prisma.weekPlan.findMany({
      where: { userId: session.user.id },
      orderBy: { lastOrderedAt: { sort: "asc", nulls: "first" } },
    }),
    prisma.recipe.findMany({ where: { userId: session.user.id }, select: { id: true, title: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { grocer: true } }),
  ]);
  const grocerName = (await getTranslations("grocer"))(asGrocer(me?.grocer));
  const titleById = new Map(recipes.map((r) => [r.id, r.title]));

  const items: WeekPlanCard[] = plans.map((p) => {
    const present = p.recipeIds.filter((id) => titleById.has(id));
    return {
      id: p.id,
      name: p.name,
      recipeIds: present,
      recipeTitles: present.map((id) => titleById.get(id)!),
      lastUsedLabel: lastUsedLabel(p.lastOrderedAt, t as Translator),
      everOrdered: p.lastOrderedAt != null,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("subtitle")}</p>

      <div className="mt-6">
        {items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-stone-500">
            {t("empty")}{" "}
            {isGuest ? null : (
              <>
                {t("emptyHintPrefix")}
                <Link href="/recipes" className="text-brand-600 hover:underline">
                  {t("emptyHintLink")}
                </Link>
                {t("emptyHintSuffix")}
              </>
            )}
          </div>
        ) : (
          <WeekPlanList plans={items} readOnly={isGuest} grocerName={grocerName} />
        )}
      </div>
    </div>
  );
}
