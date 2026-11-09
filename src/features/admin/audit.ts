import "server-only";

/*
 * Audit trail for admin product changes. The schema has no generic audit table
 * (EnquiryActivity covers enquiries only) and this slice adds no migration, so
 * product status and verification changes are written as one structured line
 * on the server log: ids, enum values and outcome only, never email addresses,
 * names or other personal data. A database audit table is a later sub-project.
 */

export type AuditEvent = "product.status" | "product.verified";

export type AuditFields = {
  actorId: string;
  actorRole: string;
  productId: string;
  outcome: "ok" | "denied" | "rejected";
  from?: string | boolean;
  to?: string | boolean;
  /** Extra effect, e.g. an unverified product also being unpublished. */
  effect?: string;
};

export function auditLog(event: AuditEvent, fields: AuditFields): void {
  console.info("[admin.audit]", JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}
