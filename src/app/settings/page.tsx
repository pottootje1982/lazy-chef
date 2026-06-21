import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { picnicUnlink } from "@/lib/picnic-actions";
import { paprikaDisconnect } from "@/lib/paprika-actions";
import { ahUnlink } from "@/lib/ah-actions";
import { ahAuthUrl } from "@/lib/ah";
import { signState } from "@/lib/ah-state";
import { asGrocer } from "@/lib/grocer";
import Link from "next/link";
import PicnicConnect from "./PicnicConnect";
import PaprikaConnect from "./PaprikaConnect";
import ChangePassword from "./ChangePassword";
import WeekPlanSettings from "./WeekPlanSettings";
import LanguageSettings from "./LanguageSettings";
import GrocerSwitch from "./GrocerSwitch";
import AhConnect from "./AhConnect";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("settings");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const linked = Boolean(user?.picnicAuthKey);
  const ahLinked = Boolean(user?.ahAuthKey);
  const activeGrocer = asGrocer(user?.grocer);
  const paprikaLinked = Boolean(user?.paprikaEmail);
  const isGuest = Boolean(session.user.isGuest);
  const hasPassword = Boolean(user?.passwordHash);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {!isGuest ? (
        <div className="card mb-6 p-6">
          <h2 className="text-lg font-semibold">{t("activeGrocerTitle")}</h2>
          <p className="mt-1 text-sm text-stone-500">{t("activeGrocerDesc")}</p>
          <div className="mt-5">
            <GrocerSwitch active={activeGrocer} />
          </div>
        </div>
      ) : null}

      <div className="card p-6">
        <h2 className="text-lg font-semibold">{t("languageTitle")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("languageDesc")}</p>
        <div className="mt-5">
          <LanguageSettings />
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">{t("picnicTitle")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("picnicDesc")}</p>

        <div className="mt-5">
          {linked ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                <span className="h-2 w-2 rounded-full bg-green-500" /> {t("picnicConnected")}
              </span>
              <form action={picnicUnlink}>
                <button className="btn-danger !py-1.5">{t("disconnect")}</button>
              </form>
            </div>
          ) : (
            <PicnicConnect />
          )}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">{t("ahTitle")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("ahDesc")}</p>
        <div className="mt-5">
          {ahLinked ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                <span className="h-2 w-2 rounded-full bg-green-500" /> {t("ahConnected")}
              </span>
              <form action={ahUnlink}>
                <button className="btn-danger !py-1.5">{t("disconnect")}</button>
              </form>
            </div>
          ) : (
            <AhConnect authUrl={ahAuthUrl(signState(session.user.id))} />
          )}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">{t("paprikaTitle")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("paprikaDesc")}</p>
        <div className="mt-5">
          {paprikaLinked ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <span className="h-2 w-2 rounded-full bg-green-500" />{" "}
                  {t("paprikaConnectedAs", { email: user?.paprikaEmail ?? "" })}
                </span>
                <form action={paprikaDisconnect}>
                  <button className="btn-danger !py-1.5">{t("disconnect")}</button>
                </form>
              </div>
              <Link href="/recipes/import/paprika" className="btn-primary">
                {t("importFromPaprika")}
              </Link>
            </div>
          ) : (
            <PaprikaConnect />
          )}
        </div>
      </div>

      {!isGuest ? (
        <div className="card mt-6 p-6">
          <h2 className="text-lg font-semibold">{t("weekPlansTitle")}</h2>
          <p className="mt-1 text-sm text-stone-500">{t("weekPlansDesc")}</p>
          <div className="mt-5">
            <WeekPlanSettings
              enabled={user?.autoWeekPlanEnabled ?? true}
              minRecipes={user?.autoWeekPlanMinRecipes ?? 3}
            />
          </div>
        </div>
      ) : null}

      {!isGuest ? (
        <div className="card mt-6 p-6">
          <h2 className="text-lg font-semibold">{t("passwordTitle")}</h2>
          <p className="mt-1 text-sm text-stone-500">
            {hasPassword ? t("passwordDescChange") : t("passwordDescSet")}
          </p>
          <div className="mt-5">
            <ChangePassword hasPassword={hasPassword} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
