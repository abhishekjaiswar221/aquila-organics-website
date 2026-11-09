const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The canonical (lower-case) form of a uuid string, or null for anything else. */
export function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return UUID.test(v) ? v : null;
}
