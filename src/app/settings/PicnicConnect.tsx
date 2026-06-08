"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { picnicConnect, type PicnicConnectState } from "@/lib/picnic-actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("common");
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t("pleaseWait") : label}
    </button>
  );
}

const INITIAL: PicnicConnectState = { step: "credentials" };

export default function PicnicConnect() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, formAction] = useActionState(picnicConnect, INITIAL);
  const step = state?.step ?? "credentials";

  return (
    <form action={formAction} className="space-y-3">
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {step === "credentials" ? (
        <>
          <div>
            <label className="label" htmlFor="email">
              {t("picnicEmail")}
            </label>
            <input id="email" name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="password">
              {t("picnicPassword")}
            </label>
            <input id="password" name="password" type="password" className="input" required />
          </div>
          <p className="text-xs text-stone-400">{t("picnicCredsHint")}</p>
          <SubmitButton label={tc("connectPicnic")} />
        </>
      ) : (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {t("picnicSmsSent")}
          </div>
          <div>
            <label className="label" htmlFor="code">
              {t("smsCode")}
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input"
              required
            />
          </div>
          <SubmitButton label={t("verifyConnect")} />
        </>
      )}
    </form>
  );
}
