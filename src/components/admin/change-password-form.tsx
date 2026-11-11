"use client";

import { useActionState, useEffect } from "react";
import { ADMIN_HOME_PATH } from "@/features/admin/login";
import { changeOwnPassword } from "@/features/users/actions";
import { buttonCls, inputCls, labelCls } from "./ui";

const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirm", label: "Repeat new password", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [state, action, pending] = useActionState(changeOwnPassword, null);
  const errors = state && !state.ok ? state.errors : undefined;
  const done = state?.ok === true;
  // Full navigation, not a soft redirect: the router may hold a cached "/admin/products redirects here"
  // from the sign-in landing, which would bounce the user straight back to this page.
  useEffect(() => {
    if (done) window.location.assign(ADMIN_HOME_PATH);
  }, [done]);
  return (
    <form action={action} noValidate className="mt-6 space-y-5">
      <p role="alert" className="min-h-5 text-sm font-medium text-destructive">
        {state && !state.ok ? state.message : null}
      </p>
      {FIELDS.map((f) => {
        const error = errors?.[f.name];
        return (
          <div key={f.name}>
            <label htmlFor={`pw-${f.name}`} className={labelCls}>
              {f.label}
            </label>
            <input
              id={`pw-${f.name}`}
              name={f.name}
              type="password"
              autoComplete={f.autoComplete}
              required
              minLength={f.name === "newPassword" ? minLength : undefined}
              className={inputCls}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `pw-${f.name}-error` : undefined}
            />
            {error ? (
              <p id={`pw-${f.name}-error`} className="mt-1 text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <p className="text-sm text-muted-foreground">Use at least {minLength} characters. Other devices are signed out.</p>
      <button type="submit" disabled={pending} className={`${buttonCls} w-full`}>
        {pending || done ? "Saving\u{2026}" : "Change password"}
      </button>
    </form>
  );
}
