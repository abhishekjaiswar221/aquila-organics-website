import type { Prisma } from "@/generated/prisma/client";

/** Application references: `CA-<year>-<6-digit sequence>`, e.g. CA-2026-000123. */
export const APPLICATION_REFERENCE_PATTERN = /^CA-\d{4}-\d{6}$/;

const MAX_SEQ = 999_999;
/** Advisory-lock namespace of its own, so applications and enquiries never block each other. */
const APPLICATION_LOCK_NAMESPACE = 0x41510002;

export function generateApplicationReference(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError("Reference year must be a four-digit integer");
  }
  if (!Number.isInteger(seq) || seq < 1 || seq > MAX_SEQ) {
    throw new RangeError("Reference sequence must be an integer from 1 to 999999");
  }
  return `CA-${year}-${String(seq).padStart(6, "0")}`;
}

/**
 * Inside a transaction: takes the per-year advisory lock and returns the next
 * CA-YYYY-NNNNNN reference. The lock is released at commit/rollback, after
 * which the next caller sees this row.
 */
export async function allocateApplicationReference(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const prefix = `CA-${year}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${APPLICATION_LOCK_NAMESPACE}::int, ${year}::int)`;
  const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
    SELECT COALESCE(MAX(substring("reference" FROM 9)::int), 0)::int AS max
    FROM "job_application"
    WHERE "reference" LIKE ${`${prefix}%`} AND "reference" ~ '^CA-[0-9]{4}-[0-9]{6}$'`;
  return generateApplicationReference(year, max + 1);
}
