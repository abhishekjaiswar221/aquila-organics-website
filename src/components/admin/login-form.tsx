"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "@/lib/auth-client";
import { GENERIC_LOGIN_ERROR, loginErrorMessage, safeAdminNext } from "@/features/admin/login";
import { buttonCls, inputCls, labelCls } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(loginErrorMessage(result.error.status));
        setPending(false);
        return;
      }
      // Full navigation: the admin pages read the new session cookie on the server.
      window.location.assign(safeAdminNext(next));
    } catch {
      setError(GENERIC_LOGIN_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
      <p id="login-error" role="alert" className="min-h-5 text-sm font-medium text-destructive">
        {error}
      </p>
      <div>
        <label htmlFor="login-email" className={labelCls}>
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputCls}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <div>
        <label htmlFor="login-password" className={labelCls}>
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <button type="submit" disabled={pending} className={`${buttonCls} w-full`}>
        {pending ? "Signing in\u{2026}" : "Sign in"}
      </button>
    </form>
  );
}
