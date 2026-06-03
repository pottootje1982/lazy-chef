"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type PasswordFormState } from "@/lib/auth-actions";

function SubmitButton({ hasPassword }: { hasPassword: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
    </button>
  );
}

export default function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction] = useActionState(
    changePassword,
    undefined as PasswordFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the change succeeds.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Password updated.
        </div>
      ) : null}

      {hasPassword ? (
        <div>
          <label className="label" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className="input"
            required
          />
        </div>
      ) : (
        <p className="text-sm text-stone-500">
          You sign in with Google. Set a password to also sign in with your email.
        </p>
      )}

      <div>
        <label className="label" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="input"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="input"
          required
        />
      </div>
      <SubmitButton hasPassword={hasPassword} />
    </form>
  );
}
