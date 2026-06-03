import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { picnicUnlink } from "@/lib/picnic-actions";
import { paprikaDisconnect } from "@/lib/paprika-actions";
import Link from "next/link";
import PicnicConnect from "./PicnicConnect";
import PaprikaConnect from "./PaprikaConnect";
import ChangePassword from "./ChangePassword";
import WeekPlanSettings from "./WeekPlanSettings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const linked = Boolean(user?.picnicAuthKey);
  const paprikaLinked = Boolean(user?.paprikaEmail);
  const isGuest = Boolean(session.user.isGuest);
  const hasPassword = Boolean(user?.passwordHash);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Picnic grocery account</h2>
        <p className="mt-1 text-sm text-stone-500">
          Link your Picnic account to match recipe ingredients to real products from the Dutch
          online grocer.
        </p>

        <div className="mt-5">
          {linked ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Connected to Picnic
              </span>
              <form action={picnicUnlink}>
                <button className="btn-danger !py-1.5">Disconnect</button>
              </form>
            </div>
          ) : (
            <PicnicConnect />
          )}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">Paprika sync</h2>
        <p className="mt-1 text-sm text-stone-500">
          Connect your Paprika account to import your recipes into this app.
        </p>
        <div className="mt-5">
          {paprikaLinked ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Connected as{" "}
                  {user?.paprikaEmail}
                </span>
                <form action={paprikaDisconnect}>
                  <button className="btn-danger !py-1.5">Disconnect</button>
                </form>
              </div>
              <Link href="/recipes/import/paprika" className="btn-primary">
                Import recipes from Paprika →
              </Link>
            </div>
          ) : (
            <PaprikaConnect />
          )}
        </div>
      </div>

      {!isGuest ? (
        <div className="card mt-6 p-6">
          <h2 className="text-lg font-semibold">Week plans</h2>
          <p className="mt-1 text-sm text-stone-500">
            When you order an ad-hoc recipe selection, it can be saved as a week plan
            automatically (no prompt).
          </p>
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
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="mt-1 text-sm text-stone-500">
            {hasPassword
              ? "Change the password you use to sign in with your email."
              : "Set a password so you can sign in with your email address."}
          </p>
          <div className="mt-5">
            <ChangePassword hasPassword={hasPassword} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
