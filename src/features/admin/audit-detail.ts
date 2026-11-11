// Pure audit sanitising (no server imports, unit-testable). Audit rows hold ids,
// enum values, field names and counts only: never emails, names or free text.

export type AuditDetail = Record<string, string | number | boolean>;

const FORBIDDEN_KEY = /email|password|name|note|text|message/i;
const MAX_VALUE_LENGTH = 80;
export const MAX_CHANGED_FIELDS = 30;

export function sanitiseAuditDetail(detail: AuditDetail | undefined): AuditDetail | undefined {
  if (!detail) return undefined;
  const out: AuditDetail = {};
  for (const [key, value] of Object.entries(detail)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (typeof value === "string") {
      if (value.length > MAX_VALUE_LENGTH) continue;
    } else if (typeof value !== "number" && typeof value !== "boolean") {
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function sanitiseAuditChangedFields(fields: readonly string[] | undefined): string[] {
  return [...new Set(fields ?? [])].slice(0, MAX_CHANGED_FIELDS);
}
