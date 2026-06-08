"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { AuthFormState } from "@/lib/auth-actions";

type Action = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const tc = useTranslations("common");
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? tc("pleaseWait") : label}
    </button>
  );
}

export default function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: Action;
}) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(action, undefined);
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="space-y-3 text-left">
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {isRegister ? (
        <div>
          <label className="label" htmlFor="name">
            {t("name")}
          </label>
          <input id="name" name="name" className="input" required autoComplete="name" />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="email">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={isRegister ? 8 : undefined}
          autoComplete={isRegister ? "new-password" : "current-password"}
        />
        {isRegister ? (
          <p className="mt-1 text-xs text-stone-400">{t("min8")}</p>
        ) : null}
      </div>

      <SubmitButton label={isRegister ? t("createAccount") : t("signIn")} />

      <p className="text-center text-sm text-stone-500">
        {isRegister ? (
          <>
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-brand-600 hover:underline">
              {t("signIn")}
            </Link>
          </>
        ) : (
          <>
            {t("newHere")}{" "}
            <Link href="/register" className="text-brand-600 hover:underline">
              {t("createAccountLink")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
