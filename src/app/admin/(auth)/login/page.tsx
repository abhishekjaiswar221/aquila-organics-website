import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { safeAdminNext } from "@/features/admin/login";
import { adminMetadata } from "@/features/admin/metadata";
import { firstParam } from "@/features/admin/search-params";
import { getAdminAccess } from "@/lib/permissions";

// Per request: reads the session cookie to send signed-in admins straight on.
export const instant = false;
export const metadata = adminMetadata("Sign in");

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const next = safeAdminNext(firstParam((await searchParams).next));
  const access = await getAdminAccess(await headers());
  if (access.kind === "allow") redirect(next);

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="bg-charcoal px-4 py-3 text-ivory sm:px-6">
        <p className="mx-auto max-w-7xl font-mono text-xs uppercase tracking-[0.18em]">
          Aquila Organics <span className="text-warm-grey">/ Admin</span>
        </p>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-12 outline-none sm:py-20">
        <div className="w-full max-w-sm border border-charcoal/20 bg-white p-6 sm:p-8">
          <h1 className="text-3xl">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Staff access to products and enquiries.</p>
          <LoginForm next={next} />
        </div>
      </main>
    </div>
  );
}
