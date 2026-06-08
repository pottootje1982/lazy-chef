import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PaprikaImportClient from "./PaprikaImportClient";

export default async function PaprikaImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("paprikaImport");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paprikaEmail: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="text-sm text-stone-500 hover:text-stone-900">
        {t("backToSettings")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("subtitle")}</p>

      <div className="mt-6">
        {user?.paprikaEmail ? (
          <PaprikaImportClient />
        ) : (
          <div className="card p-6 text-sm text-stone-500">
            {t("connectFirstPrefix")}
            <Link href="/settings" className="text-brand-600 hover:underline">
              {t("settings")}
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}
