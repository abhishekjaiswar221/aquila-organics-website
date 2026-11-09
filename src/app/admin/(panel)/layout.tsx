import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { SkipLink } from "@/components/layout/skip-link";
import { ADMIN_ROBOTS } from "@/features/admin/metadata";
import { requireAdminUser } from "@/lib/permissions";

/*
 * Admin shell. It checks the session itself (requireAdminUser: same decision
 * as requireRole) to show who is signed in, but it is NOT the authorisation
 * boundary: every page, server action and the attachment route call
 * requireRole() themselves. Per-request by nature (reads cookies), with no
 * Suspense boundary, so `instant = false` declares the blocking as intended.
 */
export const instant = false;

export const metadata: Metadata = { title: { absolute: "Admin" }, robots: ADMIN_ROBOTS };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SALES_MANAGER: "Sales manager",
};

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminUser();
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <SkipLink />
      <header className="bg-charcoal text-ivory">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin/products" className="font-mono text-xs uppercase tracking-[0.18em] text-ivory">
            Aquila Organics <span className="text-warm-grey">/ Admin</span>
          </Link>
          <AdminNav />
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <p className="min-w-0 text-warm-grey">
              <span className="sr-only">Signed in as </span>
              <span className="break-all text-ivory">{user.email}</span>
              <span aria-hidden> &middot; </span>
              <span className="sr-only">, role </span>
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
