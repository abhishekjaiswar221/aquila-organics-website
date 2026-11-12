// Admin e2e helpers: API sign-in (sharing the page's cookie jar) and direct
// TEST-database fixtures for products and enquiries. Every DB helper goes
// through withDb, which refuses anything but a *_test database.
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { access, rm, writeFile } from "node:fs/promises";
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

export type StoredProduct = {
  id: string;
  slug: string;
  name: string;
  status: string;
  verified: boolean;
  description: string | null;
  specifications: { label: string; value: string }[];
  applications: string[];
};

/** A product with its specifications and applications, found by slug (null when absent). */
export async function productBySlug(slug: string): Promise<StoredProduct | null> {
  return withDb(async (c) => {
    const { rows } = await c.query<Omit<StoredProduct, "specifications" | "applications">>(
      `SELECT "id", "slug", "name", "status"::text AS "status", "verified", "description" FROM "product" WHERE "slug" = $1`,
      [slug],
    );
    if (!rows[0]) return null;
    const specs = await c.query<{ label: string; value: string }>(
      `SELECT "label", "value" FROM "product_specification" WHERE "productId" = $1 ORDER BY "sortOrder", "createdAt"`,
      [rows[0].id],
    );
    const apps = await c.query<{ name: string }>(
      `SELECT "name" FROM "product_application" WHERE "productId" = $1 ORDER BY "sortOrder", "createdAt"`,
      [rows[0].id],
    );
    return { ...rows[0], specifications: specs.rows, applications: apps.rows.map((a) => a.name) };
  });
}

/** Removes a product (rows cascade) and the document files it owned. */
export async function deleteProductWithFiles(idOrSlug: { id?: string; slug?: string }): Promise<void> {
  const keys = await withDb(async (c) => {
    const { rows } = await c.query<{ id: string }>(`SELECT "id" FROM "product" WHERE "id" = $1 OR "slug" = $2`, [
      idOrSlug.id ?? randomUUID(),
      idOrSlug.slug ?? "",
    ]);
    const out: string[] = [];
    for (const r of rows) {
      const docs = await c.query<{ storageKey: string }>(`SELECT "storageKey" FROM "product_document" WHERE "productId" = $1`, [r.id]);
      out.push(...docs.rows.map((d) => d.storageKey));
      await c.query(`DELETE FROM "product" WHERE "id" = $1`, [r.id]);
    }
    return out;
  });
  for (const key of keys) {
    const file = path.resolve(E2E_STORAGE_ROOT, key);
    if (path.dirname(file) === E2E_STORAGE_ROOT) await rm(file, { force: true });
  }
}

export type StoredDocument = { id: string; kind: string; title: string };

export async function documentsOf(productId: string): Promise<StoredDocument[]> {
  return withDb(async (c) => {
    const { rows } = await c.query<StoredDocument>(
      `SELECT "id", "kind"::text AS "kind", "title" FROM "product_document" WHERE "productId" = $1 ORDER BY "createdAt"`,
      [productId],
    );
    return rows;
  });
}

export type StoredAudit = {
  action: string;
  actorRole: string;
  entityType: string;
  entityId: string | null;
  outcome: string;
  changedFields: string[];
  detail: Record<string, unknown> | null;
};

/** Audit rows for one entity id, oldest first. */
export async function auditRowsFor(entityId: string): Promise<StoredAudit[]> {
  return withDb(async (c) => {
    const { rows } = await c.query<StoredAudit>(
      `SELECT "action", "actorRole", "entityType", "entityId", "outcome", "changedFields", "detail"
       FROM "audit_log" WHERE "entityId" = $1 ORDER BY "at", "id"`,
      [entityId],
    );
    return rows;
  });
}

/** Inserts an audit row directly (a unique entityId per test keeps the viewer assertions deterministic). */
export async function insertAuditRow(action: string, entityType: string, entityId: string): Promise<void> {
  await withDb((c) =>
    c.query(
      `INSERT INTO "audit_log" ("id", "at", "actorRole", "action", "entityType", "entityId", "outcome", "changedFields")
       VALUES ($1, now(), 'SUPER_ADMIN', $2, $3, $4, 'ok', ARRAY[]::text[])`,
      [randomUUID(), action, entityType, entityId],
    ),
  );
}

export async function deleteAuditRowsFor(entityId: string): Promise<void> {
  await withDb((c) => c.query(`DELETE FROM "audit_log" WHERE "entityId" = $1`, [entityId]));
}

export async function userIdByEmail(email: string): Promise<string | null> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ id: string }>(`SELECT "id" FROM "user" WHERE "email" = $1`, [email]);
    return rows[0]?.id ?? null;
  });
}

/** Removes a throwaway user (sessions and accounts cascade; audit rows keep a null actor). */
export async function deleteUserByEmail(email: string): Promise<void> {
  await withDb((c) => c.query(`DELETE FROM "user" WHERE "email" = $1`, [email]));
}

/** Removes throwaway categories by exact name. */
export async function deleteCategoriesNamed(...names: string[]): Promise<void> {
  await withDb(async (c) => {
    for (const name of names) {
      await c.query(`UPDATE "product" SET "categoryId" = NULL WHERE "categoryId" IN (SELECT "id" FROM "category" WHERE "name" = $1)`, [name]);
      await c.query(`DELETE FROM "category" WHERE "name" = $1`, [name]);
    }
  });
}

export async function createCategoryRow(name: string, slug: string): Promise<string> {
  const id = randomUUID();
  await withDb((c) =>
    c.query(
      `INSERT INTO "category" ("id", "name", "slug", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX("sortOrder"), 0) + 1 FROM "category"), now(), now())`,
      [id, name, slug],
    ),
  );
  return id;
}

export async function setProductCategory(productId: string, categoryId: string): Promise<void> {
  await withDb((c) => c.query(`UPDATE "product" SET "categoryId" = $2 WHERE "id" = $1`, [productId, categoryId]));
}

/** Recipients stored for an enquiry type (empty when unset). */
export async function storedRecipients(type: string): Promise<unknown> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ value: unknown }>(`SELECT "value" FROM "site_setting" WHERE "key" = $1`, [
      `notification.recipients.${type}`,
    ]);
    return rows[0]?.value ?? null;
  });
}

export async function clearRecipients(): Promise<void> {
  await withDb((c) => c.query(`DELETE FROM "site_setting" WHERE "key" LIKE 'notification.recipients.%'`));
}

// ---------------------------------------------------------------------------
// Careers fixtures. Openings and applications are inserted directly (like the
// products and enquiries above); CV files go into the same storage root the e2e
// server reads, and every helper removes what it created.
// ---------------------------------------------------------------------------

/** A small, valid PDF (magic bytes the upload check accepts). */
export function tinyPdf(tag = randomBytes(4).toString("hex")): Buffer {
  return Buffer.from(`%PDF-1.4\n% TEST careers e2e CV ${tag}\n%%EOF\n`);
}

export type TestJob = { id: string; slug: string; title: string };

/** A throwaway opening with a unique TEST- title. PUBLISHED ones are public: use them only in @catalogue-write tests. */
export async function createJobOpening(status: "DRAFT" | "PUBLISHED" | "CLOSED", label = "job"): Promise<TestJob> {
  const tag = randomBytes(4).toString("hex");
  const job = { id: randomUUID(), slug: `test-job-${label}-${tag}`, title: `TEST-Job ${label} ${tag}` };
  await withDb((c) =>
    c.query(
      `INSERT INTO "job_opening" ("id", "slug", "title", "location", "employmentType", "summary", "description", "status", "publishedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'TEST-Location', 'FULL_TIME', 'TEST summary of a throwaway opening.', E'TEST first paragraph.\n\nTEST second paragraph.',
               $4::"JobStatus", CASE WHEN $4::text = 'DRAFT' THEN NULL ELSE now() END, now(), now())`,
      [job.id, job.slug, job.title, status],
    ),
  );
  return job;
}

export type StoredApplication = {
  id: string;
  reference: string;
  jobId: string | null;
  jobTitleSnapshot: string;
  fullName: string;
  email: string;
  status: string;
  message: string | null;
  files: { id: string; filename: string; mimeType: string; sizeBytes: number; storageKey: string }[];
};

/** Every application stored for this email address (each test uses a unique one). */
export async function applicationsFor(email: string): Promise<StoredApplication[]> {
  return withDb(async (c) => {
    const { rows } = await c.query<Omit<StoredApplication, "files">>(
      `SELECT "id", "reference", "jobId", "jobTitleSnapshot", "fullName", "email", "status"::text AS "status", "message"
       FROM "job_application" WHERE "email" = $1 ORDER BY "createdAt"`,
      [email],
    );
    const out: StoredApplication[] = [];
    for (const row of rows) {
      const files = await c.query<StoredApplication["files"][number]>(
        `SELECT "id", "filename", "mimeType", "sizeBytes", "storageKey" FROM "application_file" WHERE "applicationId" = $1`,
        [row.id],
      );
      out.push({ ...row, files: files.rows });
    }
    return out;
  });
}

export type TestApplication = StoredApplication & { cv: Buffer };

/** An application with a stored PDF, as the careers form would have left it. */
export async function createApplication(opts: { job?: TestJob; email?: string } = {}): Promise<TestApplication> {
  const tag = randomBytes(4).toString("hex");
  const id = randomUUID();
  const email = opts.email ?? `e2e-careers-${tag}@test-candidate.example`;
  const cv = tinyPdf(tag);
  const file = {
    id: randomUUID(),
    filename: `TEST-cv-${tag}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: cv.length,
    storageKey: `e2e-careers-${tag}-cv`,
  };
  await writeFile(path.join(E2E_STORAGE_ROOT, file.storageKey), cv);
  let reference = "";
  await withDb(async (c) => {
    for (let attempt = 1; ; attempt++) {
      // CA-<year>-9xxxxx: far above the sequence the app allocates in a fresh test database.
      reference = `CA-2026-9${String(randomInt(0, 100_000)).padStart(5, "0")}`;
      try {
        await c.query(
          `INSERT INTO "job_application" ("id", "reference", "jobId", "jobTitleSnapshot", "fullName", "email", "phone", "country", "message", "consentAt", "status", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, '+91 22 0000 0000', 'India', 'TEST candidate message', now(), 'NEW', now(), now())`,
          [id, reference, opts.job?.id ?? null, opts.job?.title ?? "General application", `TEST Candidate ${tag}`, email],
        );
        break;
      } catch (err) {
        if (attempt < 5 && (err as { code?: string }).code === "23505") continue;
        throw err;
      }
    }
    await c.query(
      `INSERT INTO "application_file" ("id", "applicationId", "filename", "mimeType", "sizeBytes", "storageKey", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
      [file.id, id, file.filename, file.mimeType, file.sizeBytes, file.storageKey],
    );
  });
  return {
    id,
    reference,
    jobId: opts.job?.id ?? null,
    jobTitleSnapshot: opts.job?.title ?? "General application",
    fullName: `TEST Candidate ${tag}`,
    email,
    status: "NEW",
    message: "TEST candidate message",
    files: [file],
    cv,
  };
}

/** Whether a stored object still exists in the e2e storage root. */
export async function storedFileExists(storageKey: string): Promise<boolean> {
  const file = path.resolve(E2E_STORAGE_ROOT, storageKey);
  if (path.dirname(file) !== E2E_STORAGE_ROOT) throw new Error("storage key outside the e2e root");
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Removes this test's applications (file rows cascade), their stored objects and their audit rows. */
export async function deleteApplicationsFor(email: string): Promise<void> {
  for (const a of await applicationsFor(email)) {
    for (const f of a.files) {
      const file = path.resolve(E2E_STORAGE_ROOT, f.storageKey);
      if (path.dirname(file) === E2E_STORAGE_ROOT) await rm(file, { force: true });
    }
    await withDb(async (c) => {
      await c.query(`DELETE FROM "audit_log" WHERE "entityId" = $1`, [a.id]);
      await c.query(`DELETE FROM "job_application" WHERE "id" = $1`, [a.id]);
    });
  }
}

/** Removes a throwaway opening, any applications still pointing at it, and its audit rows. */
export async function deleteJobOpening(idOrSlug: { id?: string; slug?: string }): Promise<void> {
  await withDb(async (c) => {
    const { rows } = await c.query<{ id: string }>(`SELECT "id" FROM "job_opening" WHERE "id" = $1 OR "slug" = $2`, [
      idOrSlug.id ?? randomUUID(),
      idOrSlug.slug ?? "",
    ]);
    for (const r of rows) {
      await c.query(`DELETE FROM "job_application" WHERE "jobId" = $1`, [r.id]);
      await c.query(`DELETE FROM "audit_log" WHERE "entityId" = $1`, [r.id]);
      await c.query(`DELETE FROM "job_opening" WHERE "id" = $1`, [r.id]);
    }
  });
}

export async function jobBySlug(
  slug: string,
): Promise<{ id: string; title: string; status: string; publishedAt: Date | null } | null> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ id: string; title: string; status: string; publishedAt: Date | null }>(
      `SELECT "id", "title", "status"::text AS "status", "publishedAt" FROM "job_opening" WHERE "slug" = $1`,
      [slug],
    );
    return rows[0] ?? null;
  });
}
