// Pure role/permission logic. No server imports, so it is safe in unit tests
// and in any runtime. `requireRole` (src/lib/permissions.ts) builds on it.
import type { Role } from "@/generated/prisma/enums";

export type { Role };

/** Every role in the schema, in declaration order. */
export const ROLES = [
  "SUPER_ADMIN",
  "ADMINISTRATOR",
  "SALES_MANAGER",
  "SALES_EXECUTIVE",
  "CONTENT_EDITOR",
  "HR_MANAGER",
] as const satisfies readonly Role[];

/** Roles allowed into the admin in this sub-project. */
export type AdminRole = "SUPER_ADMIN" | "SALES_MANAGER";
export const ADMIN_ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "SALES_MANAGER"];

export type AdminAction = "products.publish" | "enquiries.view" | "enquiries.update";

const PERMISSIONS: Record<AdminAction, readonly Role[]> = {
  "products.publish": ADMIN_ROLES,
  "enquiries.view": ADMIN_ROLES,
  "enquiries.update": ADMIN_ROLES,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, action: AdminAction): boolean {
  if (!Object.hasOwn(PERMISSIONS, action)) return false;
  return PERMISSIONS[action].includes(role);
}

export type SessionInfo = { userId: string; role: unknown };

export type AccessDecision =
  | { kind: "redirect" }
  | { kind: "forbidden" }
  | { kind: "allow"; userId: string; role: Role };

/** Decides what an admin request may do, given the (server-verified) session. */
export function decideAccess(
  session: SessionInfo | null,
  allowed: readonly AdminRole[],
): AccessDecision {
  if (!session) return { kind: "redirect" };
  const { userId, role } = session;
  if (!isRole(role) || !(allowed as readonly Role[]).includes(role)) return { kind: "forbidden" };
  return { kind: "allow", userId, role };
}
