import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { ADMIN_ROBOTS } from "@/features/admin/metadata";

export const metadata: Metadata = { title: { absolute: "Access denied | Admin" }, robots: ADMIN_ROBOTS };

// Rendered by forbidden() (requireRole) for a signed-in user whose role has no admin access.
export default function AdminForbidden() {
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="bg-charcoal px-4 py-3 text-ivory sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em]">
            Aquila Organics <span className="text-warm-grey">/ Admin</span>
          </p>
          <SignOutButton />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 outline-none sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-bronze-text">Error 403</p>
        <h1 className="mt-3 text-4xl">You do not have access to the admin</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          You are signed in, but your account&apos;s role cannot use this part of the site. If you need access, ask a
          super admin to change your role. You can sign out and sign in with a different account.
        </p>
        <p className="mt-8 text-sm">
          <Link href="/" className="text-bronze-text underline underline-offset-4">
            Go to the public website
          </Link>
        </p>
      </main>
    </div>
  );
}
