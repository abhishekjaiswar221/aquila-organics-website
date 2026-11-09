"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { ADMIN_LOGIN_PATH } from "@/features/admin/login";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await signOut();
        } finally {
          // A full load, so no admin page stays in the client router cache.
          window.location.assign(ADMIN_LOGIN_PATH);
        }
      }}
      className="inline-flex min-h-9 items-center border border-ivory/50 px-3 text-sm text-ivory hover:border-ivory hover:bg-ivory hover:text-charcoal disabled:opacity-60"
    >
      {pending ? "Signing out\u{2026}" : "Sign out"}
    </button>
  );
}
