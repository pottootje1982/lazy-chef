import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { loginWithCredentials } from "@/lib/auth-actions";
import AuthForm from "@/components/AuthForm";
import GoogleButton from "@/components/GoogleButton";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/recipes");

  async function googleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/recipes" });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center">
        <div className="mb-2 text-4xl">🍳</div>
        <h1 className="text-2xl font-bold">Recipe Manager</h1>
        <p className="mt-2 text-sm text-stone-500">
          Sign in to build your personal recipe collection and import recipes from the web.
        </p>

        <form className="mt-6" action={googleSignIn}>
          <GoogleButton />
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          OR
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <AuthForm mode="login" action={loginWithCredentials} />
      </div>
    </div>
  );
}
