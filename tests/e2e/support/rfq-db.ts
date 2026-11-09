// Direct reads/writes on the e2e TEST database for tests/e2e/rfq.spec.ts, so
// assertions check stored rows rather than scraping pages. Every helper
// refuses to run unless the target is a dedicated *_test database.
import { createHash, randomInt, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { E2E_STORAGE_ROOT, assertTestDatabase, e2eDatabaseUrl, e2eServerEnv } from "./e2e-env";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = e2eDatabaseUrl();
  assertTestDatabase(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export type StoredEnquiry = {
  id: string;
  reference: string;
  submissionId: string | null;
  items: { productId: string | null; name: string; cas: string | null; quantity: string; unit: string }[];
  attachments: { filename: string; storageKey: string; sizeBytes: number }[];
};

/** Every enquiry stored for this email address (each test uses a unique one). */
export async function enquiriesFor(email: string): Promise<StoredEnquiry[]> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ id: string; reference: string; submissionId: string | null }>(
      `SELECT "id", "reference", "submissionId" FROM "enquiry" WHERE "email" = $1 ORDER BY "createdAt"`,
      [email],
    );
    const out: StoredEnquiry[] = [];
    for (const row of rows) {
      const items = await c.query<StoredEnquiry["items"][number]>(
        `SELECT "productId", "productNameSnapshot" AS "name", "casSnapshot" AS "cas", "quantity"::text AS "quantity", "unit"::text AS "unit"
         FROM "enquiry_item" WHERE "enquiryId" = $1 ORDER BY "productNameSnapshot"`,
        [row.id],
      );
      const attachments = await c.query<StoredEnquiry["attachments"][number]>(
        `SELECT "filename", "storageKey", "sizeBytes" FROM "enquiry_attachment" WHERE "enquiryId" = $1`,
        [row.id],
      );
      out.push({ ...row, items: items.rows, attachments: attachments.rows });
    }
    return out;
  });
}

/** Removes this test's enquiries (rows cascade) and their attachment files. */
export async function deleteEnquiriesFor(email: string): Promise<void> {
  const stored = await enquiriesFor(email);
  for (const e of stored) {
    for (const a of e.attachments) {
      const file = path.resolve(E2E_STORAGE_ROOT, a.storageKey);
      // Only ever delete inside the e2e storage root.
      if (path.dirname(file) === E2E_STORAGE_ROOT) await rm(file, { force: true });
    }
  }
  await withDb((c) => c.query(`DELETE FROM "enquiry" WHERE "email" = $1`, [email]));
}

const WINDOW_MS = 60 * 60 * 1000;

/** Fills this IP's RFQ rate-limit bucket (current and next window) up to `count`. */
export async function seedRfqRateLimit(ip: string, count: number): Promise<void> {
  const salt = e2eServerEnv().RATE_LIMIT_SALT;
  const key = `rfq:${createHash("sha256").update(`${salt}:${ip}`).digest("hex")}`;
  const now = Date.now();
  const windows = [0, WINDOW_MS].map((offset) => new Date(Math.floor((now + offset) / WINDOW_MS) * WINDOW_MS));
  await withDb(async (c) => {
    for (const windowStart of windows) {
      await c.query(
        `INSERT INTO "rate_limit_hit" ("id", "key", "windowStart", "count", "createdAt", "updatedAt")
         VALUES ($1, $2, $3::timestamp, $4, now(), now())
         ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = $4`,
        // The column is timestamp without time zone holding UTC, as Prisma writes it.
        [randomUUID(), key, windowStart.toISOString().replace("Z", ""), count],
      );
    }
  });
}

/** A per-test client address (sent as x-forwarded-for), so tests never share a rate-limit bucket. */
export function testIp(): string {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
}

export function testEmail(): string {
  return `e2e-${randomUUID().slice(0, 12)}@test-buyer.example`;
}
