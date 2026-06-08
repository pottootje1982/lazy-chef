import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import ScanImportClient from "./ScanImportClient";

export default async function ScanImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);
  const t = await getTranslations("scan");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recipes/import" className="text-sm text-stone-500 hover:text-stone-900">
        {t("backToImport")}
      </Link>
      <h1 className="mb-2 mt-3 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-stone-500">{t("subtitle")}</p>

      {isGuest ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("guestNotice")}
        </div>
      ) : (
        <ScanImportClient />
      )}
    </div>
  );
}
