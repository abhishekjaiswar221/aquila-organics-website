"use server";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { refresh } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit, type AuditAction } from "@/features/admin/audit";
import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH } from "@/features/admin/login";
import { generatePassword } from "@/features/users/password";
import { parseChangePassword, parseCreateUser, parseRole, type UserFieldErrors } from "@/features/users/schema";
import { createCredentialUser } from "@/lib/admin-seed";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

/*
 * User management. Every exported function is a public endpoint: authorise
 * first (outside try/catch), then validate. The generated one-time password
 * exists only in the action result (and so the page's React state): it is never
 * logged, stored in plaintext or audited, and audit rows carry the user id and
 * enum/boolean details only (never an email or a name).
 */

export type UserFormState =
  | null
  | { ok: false; message?: string; errors?: UserFieldErrors }
  | { ok: true; message: string; email?: string; password?: string };

const FAILED = "The change could not be saved. Try again.";
const NOT_FOUND = "That user no longer exists.";
const BAD_ACTION = "That action is not valid.";
const SELF = "You cannot change your own role or disable your own account.";
const LAST_SUPER = "There must always be at least one active super admin.";

class NotFound extends Error {}
class Refused extends Error {}

type Actor = { userId: string; role: string };

function audit(actor: Actor, action: AuditAction, entityId: string, tx: Prisma.TransactionClient, extra?: { changedFields?: string[]; detail?: Record<string, string | boolean> }) {
  return recordAudit(
    { actorId: actor.userId, actorRole: actor.role, action, entityType: "user", entityId, outcome: "ok", ...extra },
    tx,
  );
}

/** Serialises every user-security change so the "last active super admin" recount cannot race. */
async function lockUsers(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aquila:user-admin'))`;
}

async function activeSuperAdmins(tx: Prisma.TransactionClient) {
  return tx.user.count({ where: { role: "SUPER_ADMIN", disabled: false } });
}

function failure(err: unknown): UserFormState {
  if (err instanceof NotFound) return { ok: false, message: NOT_FOUND };
  if (err instanceof Refused) return { ok: false, message: err.message };
  console.error("[admin] user change failed:", err instanceof Error ? err.name : typeof err);
  return { ok: false, message: FAILED };
}

export async function createAdminUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requireAction("users.manage");
  const parsed = parseCreateUser({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const duplicate: UserFormState = { ok: false, errors: { email: "A user with this email already exists." } };
  if (await db.user.findUnique({ where: { email: parsed.email }, select: { id: true } })) return duplicate;

  const password = generatePassword();
  try {
    const { id } = await createCredentialUser({
      email: parsed.email,
      password,
      role: parsed.role,
      name: parsed.name,
      mustChangePassword: true,
    });
    await recordAudit({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "user.create",
      entityType: "user",
      entityId: id,
      outcome: "ok",
      detail: { role: parsed.role },
    });
    refresh();
    return { ok: true, message: "User created.", email: parsed.email, password };
  } catch (err) {
    // A concurrent create of the same email loses on the unique index.
    if (await db.user.findUnique({ where: { email: parsed.email }, select: { id: true } })) return duplicate;
    return failure(err);
  }
}

/** Changes a role. Refused for yourself and for the last active super admin. */
export async function submitUserRole(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requireAction("users.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };
  const role = parseRole(formData.get("role"));
  if (!role) return { ok: false, errors: { role: "Choose a valid role." }, message: BAD_ACTION };
  try {
    await db.$transaction(async (tx) => {
      await lockUsers(tx);
      const target = await tx.user.findUnique({ where: { id }, select: { role: true, disabled: true } });
      if (!target) throw new NotFound();
      if (id === actor.userId) throw new Refused(SELF);
      if (target.role === role) return;
      await tx.user.update({ where: { id }, data: { role } });
      if (target.role === "SUPER_ADMIN" && !target.disabled && (await activeSuperAdmins(tx)) === 0) {
        throw new Refused(LAST_SUPER);
      }
      await audit(actor, "user.role", id, tx, { changedFields: ["role"], detail: { role } });
    });
    refresh();
    return { ok: true, message: "Role updated." };
  } catch (err) {
    return failure(err);
  }
}

/** Disables (deleting every session in the same transaction) or re-enables a user. */
export async function submitUserDisabled(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requireAction("users.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };
  const flag = formData.get("disabled");
  if (flag !== "true" && flag !== "false") return { ok: false, message: BAD_ACTION };
  const disabled = flag === "true";
  try {
    await db.$transaction(async (tx) => {
      await lockUsers(tx);
      const target = await tx.user.findUnique({ where: { id }, select: { role: true, disabled: true } });
      if (!target) throw new NotFound();
      if (disabled && id === actor.userId) throw new Refused(SELF);
      if (target.disabled === disabled) return;
      await tx.user.update({ where: { id }, data: { disabled } });
      if (disabled) {
        await tx.session.deleteMany({ where: { userId: id } });
        if (target.role === "SUPER_ADMIN" && (await activeSuperAdmins(tx)) === 0) throw new Refused(LAST_SUPER);
      }
      await audit(actor, disabled ? "user.disable" : "user.enable", id, tx, { changedFields: ["disabled"] });
    });
    refresh();
    return { ok: true, message: disabled ? "User disabled and signed out." : "User enabled." };
  } catch (err) {
    return failure(err);
  }
}

/** Sets a new generated password, forces a change at next sign-in and signs the user out everywhere. */
export async function submitUserReset(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requireAction("users.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };
  try {
    const ctx = await auth.$context;
    const password = generatePassword();
    const hash = await ctx.password.hash(password);
    const email = await db.$transaction(async (tx) => {
      await lockUsers(tx);
      const target = await tx.user.findUnique({ where: { id }, select: { email: true } });
      if (!target) throw new NotFound();
      const { count } = await tx.account.updateMany({ where: { userId: id, providerId: "credential" }, data: { password: hash } });
      if (count === 0) throw new Refused("That user has no password sign-in to reset.");
      await tx.user.update({ where: { id }, data: { mustChangePassword: true } });
      await tx.session.deleteMany({ where: { userId: id } });
      await audit(actor, "user.reset-password", id, tx, { changedFields: ["password"] });
      return target.email;
    });
    refresh();
    return { ok: true, message: "Password reset.", email, password };
  } catch (err) {
    return failure(err);
  }
}

const CHANGE_FAILED = "The password could not be changed. Check your current password and try again.";

/** Any signed-in, non-disabled user (including one who must change a one-time password). */
export async function changeOwnPassword(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect(ADMIN_LOGIN_PATH);
  if (session.user.disabled) forbidden();

  const parsed = parseChangePassword({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  try {
    // Better Auth verifies the current password, signs out every other session and keeps this one.
    await auth.api.changePassword({
      headers: requestHeaders,
      body: { currentPassword: parsed.currentPassword, newPassword: parsed.newPassword, revokeOtherSessions: true },
    });
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: session.user.id }, data: { mustChangePassword: false } });
    });
  } catch (err) {
    // A wrong current password and any other failure read the same: no oracle.
    if (!(err instanceof APIError)) console.error("[admin] password change failed:", err instanceof Error ? err.name : typeof err);
    return { ok: false, message: CHANGE_FAILED };
  }
  redirect(ADMIN_HOME_PATH);
}
