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

/** Roles allowed into the admin. SALES_EXECUTIVE and HR_MANAGER stay out until their own sub-projects. */
export type AdminRole = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "CONTENT_EDITOR";
export const ADMIN_ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"];

export type AdminAction =
  | "enquiries.view"
  | "enquiries.update"
  | "products.edit"
  | "products.publish"
  | "products.verify"
  | "documents.manage"
  | "settings.edit"
  | "users.manage"
  | "audit.view";

/** The one place roles are listed per action (spec section 2). */
const PERMISSIONS: Record<AdminAction, readonly Role[]> = {
  "enquiries.view": ["SUPER_ADMIN", "SALES_MANAGER"],
  "enquiries.update": ["SUPER_ADMIN", "SALES_MANAGER"],
  "products.edit": ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"],
  "products.publish": ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER"],
  "products.verify": ["SUPER_ADMIN"],
  "documents.manage": ["SUPER_ADMIN", "ADMINISTRATOR", "CONTENT_EDITOR"],
  "settings.edit": ["SUPER_ADMIN", "ADMINISTRATOR"],
  "users.manage": ["SUPER_ADMIN"],
  "audit.view": ["SUPER_ADMIN"],
};

/** The admin roles allowed to perform an action (empty for an unknown action). */
export function rolesFor(action: AdminAction): readonly AdminRole[] {
  if (!Object.hasOwn(PERMISSIONS, action)) return [];
  return PERMISSIONS[action] as readonly AdminRole[];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, action: AdminAction): boolean {
  if (!Object.hasOwn(PERMISSIONS, action)) return false;
  return PERMISSIONS[action].includes(role);
}

// Each admin page adds its link here when it ships.
const ADMIN_LINKS: { href: string; label: string; action: AdminAction }[] = [
  { href: "/admin/products", label: "Products", action: "products.edit" },
  { href: "/admin/categories", label: "Categories", action: "products.edit" },
  { href: "/admin/enquiries", label: "Enquiries", action: "enquiries.view" },
  { href: "/admin/settings", label: "Settings", action: "settings.edit" },
  { href: "/admin/audit", label: "Audit log", action: "audit.view" },
];

/** The admin navigation a role may see (pure; the pages still authorise themselves). */
export function adminLinksFor(role: Role): { href: string; label: string }[] {
  return ADMIN_LINKS.filter((l) => can(role, l.action)).map(({ href, label }) => ({ href, label }));
}

export type SessionInfo = { userId: string; role: unknown; disabled?: boolean; mustChangePassword?: boolean };

/**
 * What an admin session may do before any role check: a disabled user is shut
 * out, and a user holding a one-time password may only change it.
 */
export function adminGate(user: { disabled?: boolean; mustChangePassword?: boolean }): "ok" | "disabled" | "change-password" {
  if (user.disabled) return "disabled";
  if (user.mustChangePassword) return "change-password";
  return "ok";
}

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
  if (adminGate(session) !== "ok") return { kind: "forbidden" };
  const { userId, role } = session;
  if (!isRole(role) || !(allowed as readonly Role[]).includes(role)) return { kind: "forbidden" };
  return { kind: "allow", userId, role };
}
