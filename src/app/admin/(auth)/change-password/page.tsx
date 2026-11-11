import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { ADMIN_LOGIN_PATH } from "@/features/admin/login";
import { adminMetadata } from "@/features/admin/metadata";
import { auth, MIN_PASSWORD_LENGTH } from "@/lib/auth";

// Per request: needs the session. Lives outside the (panel) layout, whose gate
// sends a must-change user here, so it cannot loop.
export const instant = false;
export const metadata = adminMetadata("Change password");

export default async function AdminChangePasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);
  if (session.user.disabled) forbidden();

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="bg-charcoal px-4 py-3 text-ivory sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em]">
            Aquila Organics <span className="text-warm-grey">/ Admin</span>
          </p>
          <SignOutButton />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-12 outline-none sm:py-20">
        <div className="w-full max-w-sm border border-charcoal/20 bg-white p-6 sm:p-8">
          <h1 className="text-3xl">Change password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {session.user.mustChangePassword
              ? "You signed in with a one-time password. Choose your own to continue."
              : "Choose a new password for your account."}
          </p>
          <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
        </div>
      </main>
    </div>
  );
}
