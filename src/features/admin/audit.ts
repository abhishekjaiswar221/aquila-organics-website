import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { sanitiseAuditChangedFields, sanitiseAuditDetail, type AuditDetail } from "@/features/admin/audit-detail";
import { db } from "@/lib/db";

/*
 * Database audit trail for admin changes. Rows hold ids, enum values, field
 * names and counts only (see audit-detail.ts); never emails, names or free
 * text. Pass the transaction so the audit row commits or rolls back with the
 * change itself.
 */

export const AUDIT_ACTIONS = [
  "product.create",
  "product.update",
  "product.status",
  "product.verified",
  "product.reverify",
  "category.create",
  "category.update",
  "category.delete",
  "document.upload",
  "document.delete",
  "settings.recipients",
  "user.create",
  "user.role",
  "user.disable",
  "user.enable",
  "user.reset-password",
  "enquiry.status",
  "job.create",
  "job.update",
  "job.status",
  "job.delete",
  "application.status",
  "application.delete",
  "application.cv-download",
  "application.email",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditOutcome = "ok" | "denied" | "rejected";

export type AuditInput = {
  actorId: string | null;
  actorRole: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  outcome: AuditOutcome;
  changedFields?: string[];
  detail?: AuditDetail;
};

export async function recordAudit(input: AuditInput, tx?: Prisma.TransactionClient): Promise<void> {
  const detail = sanitiseAuditDetail(input.detail);
  await (tx ?? db).auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      outcome: input.outcome,
      changedFields: sanitiseAuditChangedFields(input.changedFields),
      ...(detail ? { detail } : {}),
    },
  });
}

/** Best-effort write for denied/rejected attempts: a failed audit must not change the answer. */
export async function recordAuditBestEffort(input: AuditInput): Promise<void> {
  try {
    await recordAudit(input);
  } catch (err) {
    console.error("[admin] audit write failed:", err instanceof Error ? err.name : typeof err);
  }
}
