import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT_ACTIONS, type AuditAction } from "@/features/admin/audit";
import { normalizePage } from "@/features/products/admin-queries";
import { db } from "@/lib/db";
import { normalizeUuid } from "@/lib/uuid";

/* Admin-only audit reads; callers authorise first with requireAction("audit.view"). */

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilter = {
  action?: AuditAction;
  entityType?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  page: number;
};

export type AuditRow = {
  id: string;
  at: Date;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: string;
  changedFields: string[];
};

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

const validDate = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

export async function listAudit(filter: AuditFilter): Promise<{ rows: AuditRow[]; total: number }> {
  const page = normalizePage(filter.page);
  const entityType = typeof filter.entityType === "string" ? filter.entityType.trim().slice(0, 60) : "";
  const actorId = filter.actorId ? normalizeUuid(filter.actorId) : null;
  const at: Prisma.DateTimeFilter = {};
  if (validDate(filter.from)) at.gte = filter.from;
  if (validDate(filter.to)) at.lte = filter.to;

  const where: Prisma.AuditLogWhereInput = {
    ...(isAuditAction(filter.action) ? { action: filter.action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(Object.keys(at).length > 0 ? { at } : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        at: true,
        actorId: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        outcome: true,
        changedFields: true,
      },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
  ]);
  return { rows, total };
}
