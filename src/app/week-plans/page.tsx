import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WeekPlanList, { type WeekPlanCard } from "./WeekPlanList";

function lastUsedLabel(d: Date | null): string {
  if (!d) return "Never ordered";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Last ordered today";
  if (days === 1) return "Last ordered yesterday";
  if (days < 7) return `Last ordered ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Last ordered ${weeks} week${weeks > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Last ordered ${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `Last ordered ${years} year${years > 1 ? "s" : ""} ago`;
}

export default async function WeekPlansPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);

  const [plans, recipes] = await Promise.all([
    prisma.weekPlan.findMany({
      where: { userId: session.user.id },
      orderBy: { lastOrderedAt: { sort: "asc", nulls: "first" } },
    }),
    prisma.recipe.findMany({ where: { userId: session.user.id }, select: { id: true, title: true } }),
  ]);
  const titleById = new Map(recipes.map((r) => [r.id, r.title]));

  const items: WeekPlanCard[] = plans.map((p) => {
    const present = p.recipeIds.filter((id) => titleById.has(id));
    return {
      id: p.id,
      name: p.name,
      recipeIds: present,
      recipeTitles: present.map((id) => titleById.get(id)!),
      lastUsedLabel: lastUsedLabel(p.lastOrderedAt),
      everOrdered: p.lastOrderedAt != null,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Week plans</h1>
      <p className="mt-1 text-sm text-stone-500">
        Saved batches of recipes you can re-order in one click. The plan you used longest ago (or
        never) shows on top.
      </p>

      <div className="mt-6">
        {items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-stone-500">
            No week plans yet.{" "}
            {isGuest ? null : (
              <>
                Select recipes on the{" "}
                <Link href="/recipes" className="text-brand-600 hover:underline">
                  recipes page
                </Link>{" "}
                and choose “Save as week plan”.
              </>
            )}
          </div>
        ) : (
          <WeekPlanList plans={items} readOnly={isGuest} />
        )}
      </div>
    </div>
  );
}
