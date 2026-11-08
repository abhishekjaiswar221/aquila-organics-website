import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { ADMIN_ROLES, decideAccess, type AdminRole, type Role } from "@/lib/access";
import { auth } from "@/lib/auth";

export { ADMIN_ROLES, can, type AdminAction, type AdminRole, type Role } from "@/lib/access";

export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Server-side gate for every admin page, route handler and server action.
 * Reads the session from the incoming request's cookies (verified by Better
 * Auth against the database), then:
 * - no valid session  -> `redirect('/admin/login')`
 * - role not allowed  -> `forbidden()` (403; needs experimental.authInterrupts)
 * Both throw, so call it outside any try/catch and always `await` it.
 */
export async function requireRole(
  allowed: AdminRole[] = [...ADMIN_ROLES],
): Promise<{ userId: string; role: Role }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const decision = decideAccess(
    session ? { userId: session.user.id, role: session.user.role } : null,
    allowed,
  );
  if (decision.kind === "redirect") redirect(ADMIN_LOGIN_PATH);
  if (decision.kind === "forbidden") forbidden();
  return { userId: decision.userId, role: decision.role };
}
