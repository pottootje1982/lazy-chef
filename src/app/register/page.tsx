import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/lib/auth";
import { registerWithCredentials } from "@/lib/auth-actions";
import AuthForm from "@/components/AuthForm";
import GoogleButton from "@/components/GoogleButton";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/recipes");
  const t = await getTranslations("auth");

  async function googleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/recipes" });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center">
        <div className="mb-2 text-4xl">🍳</div>
        <h1 className="text-2xl font-bold">{t("registerTitle")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("registerSubtitle")}</p>

        <form className="mt-6" action={googleSignIn}>
          <GoogleButton />
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          {t("or")}
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <AuthForm mode="register" action={registerWithCredentials} />
      </div>
    </div>
  );
}
