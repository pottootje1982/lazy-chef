"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { paprikaConnect, type PaprikaConnectState } from "@/lib/paprika-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Connecting…" : "Connect Paprika"}
    </button>
  );
}

export default function PaprikaConnect() {
  const [state, formAction] = useActionState(paprikaConnect, undefined as PaprikaConnectState | undefined);

  return (
    <form action={formAction} className="space-y-3">
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="paprika-email">
          Paprika email
        </label>
        <input id="paprika-email" name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="paprika-password">
          Paprika password
        </label>
        <input id="paprika-password" name="password" type="password" className="input" required />
      </div>
      <p className="text-xs text-stone-400">
        Used to sync your recipes. The password is stored encrypted.
      </p>
      <SubmitButton />
    </form>
  );
}
