import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PantrySettings from "./PantrySettings";

export default async function PantryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);
  const t = await getTranslations("pantry");

  const [user, mappings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { pantryKeywords: true },
    }),
    prisma.productMapping.findMany({
      where: { userId: session.user.id },
      select: { picnicId: true, ingredientKey: true, productName: true, isStaple: true },
      orderBy: { productName: "asc" },
    }),
  ]);
  const keywords = user?.pantryKeywords ?? [];

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        {t("backToRecipes")}
      </Link>
      <h1 className="mb-2 mt-3 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-stone-500">{t("subtitle")}</p>

      <div className="card p-6">
        {isGuest ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map((w) => (
              <span key={w} className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {w}
              </span>
            ))}
            <span className="text-sm text-stone-400">{t("readOnly")}</span>
          </div>
        ) : (
          <PantrySettings keywords={keywords} mappings={mappings} />
        )}
      </div>
    </div>
  );
}
