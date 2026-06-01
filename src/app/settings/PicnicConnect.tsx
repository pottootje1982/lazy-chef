"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { picnicConnect, type PicnicConnectState } from "@/lib/picnic-actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

const INITIAL: PicnicConnectState = { step: "credentials" };

export default function PicnicConnect() {
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
              Picnic email
            </label>
            <input id="email" name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Picnic password
            </label>
            <input id="password" name="password" type="password" className="input" required />
          </div>
          <p className="text-xs text-stone-400">
            Your credentials are used once to obtain an access key, which is stored encrypted. We
            never store your password.
          </p>
          <SubmitButton label="Connect Picnic" />
        </>
      ) : (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Picnic sent a verification code by SMS. Enter it below to finish connecting.
          </div>
          <div>
            <label className="label" htmlFor="code">
              SMS code
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
          <SubmitButton label="Verify & connect" />
        </>
      )}
    </form>
  );
}
