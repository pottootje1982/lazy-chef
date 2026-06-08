import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import ImportClient from "./ImportClient";
import ScanFilePicker from "./ScanFilePicker";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("import");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-stone-500">{t("subtitle")}</p>
      <ImportClient />

      <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h2 className="text-sm font-semibold text-stone-700">{t("noLinkScan")}</h2>
        <p className="mb-3 mt-1 text-sm text-stone-500">{t("scanDesc")}</p>
        <ScanFilePicker />
      </div>
    </div>
  );
}
