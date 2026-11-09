// Admin e2e helpers: API sign-in (sharing the page's cookie jar) and direct
// TEST-database fixtures for products and enquiries. Every DB helper goes
// through withDb, which refuses anything but a *_test database.
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_STORAGE_ROOT } from "./e2e-env";
import type { AdminUser } from "./fixtures";
import { testIp, withDb } from "./rfq-db";

/** Signs in through the Better Auth endpoint; the session cookie lands in the page's context. */
export async function signInViaApi(page: Page, user: AdminUser): Promise<void> {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
    headers: { origin: E2E_BASE_URL, "x-forwarded-for": testIp() },
  });
  expect(res.status(), `sign in as ${user.role}`).toBe(200);
}

export type TestProduct = { id: string; slug: string; name: string; code: string };

/** A fresh, unverified DRAFT product with a unique TEST- name. */
export async function createDraftProduct(label: string): Promise<TestProduct> {
  const tag = randomBytes(4).toString("hex");
  const p = {
    id: randomUUID(),
    slug: `test-admin-${label}-${tag}`,
    name: `TEST-Admin ${label} ${tag}`,
    code: `TEST-ADM-${tag.toUpperCase()}`,
  };
  await withDb((c) =>
    c.query(
      `INSERT INTO "product" ("id", "name", "slug", "code", "status", "verified", "sourceNote", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'DRAFT', false, 'TEST-admin e2e fixture', now(), now())`,
      [p.id, p.name, p.slug, p.code],
    ),
  );
  return p;
}

export async function productState(id: string): Promise<{ status: string; verified: boolean; publishedAt: Date | null }> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ status: string; verified: boolean; publishedAt: Date | null }>(
      `SELECT "status"::text AS "status", "verified", "publishedAt" FROM "product" WHERE "id" = $1`,
      [id],
    );
    if (!rows[0]) throw new Error(`no product ${id}`);
    return rows[0];
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await withDb((c) => c.query(`DELETE FROM "product" WHERE "id" = $1`, [id]));
}

export type TestEnquiry = {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  attachment: { id: string; filename: string; storageKey: string; bytes: Buffer };
  csv: { id: string; filename: string; storageKey: string };
};

/** An enquiry as the RFQ form stores it: two lines, a PDF and a CSV attachment, and its creation activity. */
export async function createEnquiry(): Promise<TestEnquiry> {
  const tag = randomBytes(4).toString("hex");
  const id = randomUUID();
  // AQ-<year>-9xxxxx: far above the sequence the app allocates in a fresh test database.
  let reference = "";
  const fullName = `TEST Admin Buyer ${tag}`;
  const email = `e2e-admin-${tag}@test-buyer.example`;
  const pdf = {
    id: randomUUID(),
    filename: `TEST-spec-${tag}.pdf`,
    storageKey: `e2e-admin-${tag}-pdf`,
    bytes: Buffer.from(`%PDF-1.4\n% TEST admin e2e attachment ${tag}\n%%EOF\n`),
  };
  const csv = { id: randomUUID(), filename: `TEST-prices-${tag}.csv`, storageKey: `e2e-admin-${tag}-csv` };
  await writeFile(path.join(E2E_STORAGE_ROOT, pdf.storageKey), pdf.bytes);
  await writeFile(path.join(E2E_STORAGE_ROOT, csv.storageKey), "name,qty\nTEST,1\n");
  await withDb(async (c) => {
    for (let attempt = 1; ; attempt++) {
      reference = `AQ-2026-9${String(randomInt(0, 100_000)).padStart(5, "0")}`;
      try {
        await c.query(
          `INSERT INTO "enquiry" ("id", "reference", "type", "status", "fullName", "companyName", "email", "phone", "country",
             "businessSegment", "intendedApplication", "consentAt", "ipHash", "userAgent", "createdAt", "updatedAt")
           VALUES ($1, $2, 'AROMA_CHEMICALS', 'NEW', $3, 'TEST Fragrance House Ltd', $4, '+44 20 7946 0000', 'United Kingdom',
             'FRAGRANCES', 'TEST fine fragrance', now(), 'TEST-ip-hash-secret', 'TEST-user-agent-secret', now(), now())`,
          [id, reference, fullName, email],
        );
        break;
      } catch (err) {
        // Reference clash with a parallel test: pick another.
        if (attempt < 5 && (err as { code?: string }).code === "23505") continue;
        throw err;
      }
    }
    await c.query(
      `INSERT INTO "enquiry_item" ("id", "enquiryId", "productNameSnapshot", "casSnapshot", "quantity", "unit", "notes", "createdAt", "updatedAt")
       VALUES ($1, $2, 'TEST-Ethanol', '64-17-5', 25, 'KG', 'TEST line note', now(), now()),
              ($3, $2, 'TEST-Free text compound', NULL, 1.5, 'L', NULL, now(), now())`,
      [randomUUID(), id, randomUUID()],
    );
    for (const a of [
      { ...pdf, mimeType: "application/pdf", size: pdf.bytes.length },
      { ...csv, mimeType: "text/csv", size: 16 },
    ]) {
      await c.query(
        `INSERT INTO "enquiry_attachment" ("id", "enquiryId", "filename", "mimeType", "sizeBytes", "storageKey", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
        [a.id, id, a.filename, a.mimeType, a.size, a.storageKey],
      );
    }
    await c.query(
      `INSERT INTO "enquiry_activity" ("id", "enquiryId", "action", "detail", "createdAt", "updatedAt")
       VALUES ($1, $2, 'enquiry.created', $3, now(), now())`,
      [randomUUID(), id, JSON.stringify({ source: "rfq-form", items: 2, catalogueItems: 0, attachments: 2 })],
    );
  });
  return { id, reference, fullName, email, attachment: pdf, csv };
}

export async function activitiesOf(
  enquiryId: string,
): Promise<{ action: string; actorId: string | null; detail: Record<string, unknown> | null }[]> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ action: string; actorId: string | null; detail: Record<string, unknown> | null }>(
      `SELECT "action", "actorId", "detail" FROM "enquiry_activity" WHERE "enquiryId" = $1 ORDER BY "createdAt", "id"`,
      [enquiryId],
    );
    return rows;
  });
}

export async function deleteEnquiry(e: TestEnquiry): Promise<void> {
  await withDb((c) => c.query(`DELETE FROM "enquiry" WHERE "id" = $1`, [e.id]));
  for (const key of [e.attachment.storageKey, e.csv.storageKey]) {
    await rm(path.join(E2E_STORAGE_ROOT, key), { force: true });
  }
}
