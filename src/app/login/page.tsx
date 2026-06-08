import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/lib/auth";
import { loginWithCredentials } from "@/lib/auth-actions";
import AuthForm from "@/components/AuthForm";
import GoogleButton from "@/components/GoogleButton";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/recipes");
  const t = await getTranslations("auth");

  async function googleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/recipes" });
  }

  async function guestSignIn() {
    "use server";
    await signIn("guest", { redirectTo: "/recipes" });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center">
        <div className="mb-2 text-4xl">🍳</div>
        <h1 className="text-2xl font-bold">{t("appName")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("loginSubtitle")}</p>

        <form className="mt-6" action={googleSignIn}>
          <GoogleButton />
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          {t("or")}
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <AuthForm mode="login" action={loginWithCredentials} />

        <div className="mt-6 border-t border-stone-200 pt-4">
          <form action={guestSignIn}>
            <button type="submit" className="text-sm text-stone-500 hover:text-brand-600">
              {t("continueAsGuest")}
            </button>
          </form>
          <p className="mt-1 text-xs text-stone-400">{t("guestHint")}</p>
        </div>
      </div>
    </div>
  );
}
