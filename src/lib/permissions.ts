import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { ADMIN_ROLES, adminGate, decideAccess, rolesFor, type AccessDecision, type AdminAction, type AdminRole, type Role } from "@/lib/access";
import { auth } from "@/lib/auth";
import { ADMIN_CHANGE_PASSWORD_PATH, ADMIN_LOGIN_PATH } from "@/features/admin/login";

export { ADMIN_ROLES, adminLinksFor, can, rolesFor, type AdminAction, type AdminRole, type Role } from "@/lib/access";
export { ADMIN_CHANGE_PASSWORD_PATH, ADMIN_LOGIN_PATH };

type SessionUser = { id: string; role: unknown; disabled?: boolean | null; mustChangePassword?: boolean | null };

function sessionInfo(session: { user: SessionUser }) {
  const { id, role, disabled, mustChangePassword } = session.user;
  return { userId: id, role, disabled: disabled === true, mustChangePassword: mustChangePassword === true };
}

/**
 * The access decision for a request's headers, without throwing. Route
 * handlers use it to answer 401/403 themselves (they cannot redirect to a
 * page); pages and server actions use requireRole() below, which builds on it.
 */
export async function getAdminAccess(
  requestHeaders: Headers,
  allowed: readonly AdminRole[] = ADMIN_ROLES,
): Promise<AccessDecision> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  return decideAccess(session ? sessionInfo(session) : null, allowed);
}

/**
 * requireRole() for the admin shell, which also shows who is signed in: same
 * decision and the same redirect/forbidden interrupts, plus the email (for
 * display only; never logged).
 */
export async function requireAdminUser(): Promise<{ userId: string; role: Role; email: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  // A user holding a one-time password may only change it: send them there first.
  if (session && !session.user.disabled && adminGate(sessionInfo(session)) === "change-password") {
    redirect(ADMIN_CHANGE_PASSWORD_PATH);
  }
  const decision = decideAccess(session ? sessionInfo(session) : null, ADMIN_ROLES);
  if (decision.kind === "redirect" || !session) redirect(ADMIN_LOGIN_PATH);
  if (decision.kind === "forbidden") forbidden();
  return { userId: decision.userId, role: decision.role, email: session.user.email };
}

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
  const decision = await getAdminAccess(await headers(), allowed);
  if (decision.kind === "redirect") redirect(ADMIN_LOGIN_PATH);
  if (decision.kind === "forbidden") forbidden();
  return { userId: decision.userId, role: decision.role };
}

/**
 * requireRole() for one named action: the roles come from the permission table
 * in src/lib/access.ts, so a page or Server Action states what it does, not who
 * may. Same redirect/forbidden interrupts; call it first, outside any try/catch.
 */
export async function requireAction(action: AdminAction): Promise<{ userId: string; role: Role }> {
  return requireRole([...rolesFor(action)]);
}
