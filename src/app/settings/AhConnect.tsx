"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { ahConnect, type AhConnectState } from "@/lib/ah-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? tc("pleaseWait") : t("ahConnectButton")}
    </button>
  );
}

export default function AhConnect({ authUrl }: { authUrl: string }) {
  const t = useTranslations("settings");
  const [state, formAction] = useActionState(ahConnect, undefined as AhConnectState);

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">{t("ahAutoNote")}</p>
      <a
        href={authUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-block"
      >
        {t("openAhLogin")}
      </a>
      <p className="text-xs text-stone-400">{t("ahSetupHint")}</p>

      <details className="pt-1">
        <summary className="cursor-pointer text-sm font-medium text-stone-500 hover:text-stone-700">
          {t("ahManualToggle")}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-stone-500">{t("ahLoginInstructions")}</p>
          <form action={formAction} className="space-y-3">
            {state?.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </div>
            ) : null}
            <div>
              <label className="label" htmlFor="ah-code">
                {t("ahCodeLabel")}
              </label>
              <input
                id="ah-code"
                name="code"
                type="text"
                autoComplete="off"
                placeholder={t("ahCodePlaceholder")}
                className="input"
                required
              />
            </div>
            <SubmitButton />
          </form>
        </div>
      </details>
    </div>
  );
}
