import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

// Real users, real Better Auth sessions and the real requireRole(): the only
// fakes are the request headers (there is no Next.js request scope in Vitest)
// and the storage root (a temporary directory).
const state = vi.hoisted(() => ({ headers: new Headers(), root: "" }));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => state.headers,
}));

vi.mock("@/lib/storage", async () => {
  const { LocalStorage } = await import("@/lib/storage/local");
  return { getStorage: () => new LocalStorage(state.root) };
});

const { auth } = await import("@/lib/auth");
const { createCredentialUser } = await import("@/lib/admin-seed");
const { setProductStatus, setProductVerified } = await import("@/features/products/admin-actions");
const { listAdminProducts } = await import("@/features/products/admin-queries");
const { isPublishCheckViolation, PUBLISH_REQUIREMENTS_ERROR, UNVERIFIED_ERROR } = await import("@/features/products/publish-guard");
const { setEnquiryStatus } = await import("@/features/enquiries/admin-actions");
const { getEnquiry, listEnquiries, missingRecipientTypes } = await import("@/features/enquiries/queries");
const { searchProducts } = await import("@/features/products/queries");
const { GET: downloadAttachment, HEAD: headAttachment } = await import("@/app/api/admin/attachments/[id]/route");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "SALES_EXECUTIVE" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "SALES_EXECUTIVE", "CONTENT_EDITOR", "HR_MANAGER"];
const DENIED: Role[] = ["CONTENT_EDITOR", "HR_MANAGER", "SALES_EXECUTIVE", "ADMINISTRATOR"];

const cookies = new Map<Role, string>();
const userIds = new Map<Role, string>();

const emailFor = (role: Role) => `test-${role.toLowerCase().replace(/_/g, "-")}@admin.example.test`;
const passwordFor = (role: Role) => `TEST-${role.toLowerCase()}-passphrase`;

function signedInAs(role: Role | null): void {
  state.headers = role ? new Headers({ cookie: cookies.get(role) ?? "" }) : new Headers();
}

function digestOf(error: unknown): string {
  return error instanceof Error && "digest" in error ? String(error.digest) : String(error);
}

async function expectForbidden(run: () => Promise<unknown>) {
  const error = await run().then(
    () => "resolved",
    (e: unknown) => e,
  );
  expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
}

async function expectLoginRedirect(run: () => Promise<unknown>) {
  const error = await run().then(
    () => "resolved",
    (e: unknown) => e,
  );
  expect(digestOf(error)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;307;/);
}

async function makeProduct(
  slug: string,
  data: { status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; verified?: boolean; name?: string; publishedAt?: Date } = {},
) {
  return db.product.create({
    data: {
      name: data.name ?? `TEST-${slug}`,
      slug,
      code: `TEST-${slug.toUpperCase()}`,
      sourceNote: "TEST-legacy, unverified",
      status: data.status ?? "DRAFT",
      verified: data.verified ?? false,
      publishedAt: data.publishedAt ?? null,
    },
  });
}

let enquiryCounter = 0;
async function makeEnquiry(data: { status?: "NEW" | "CONTACTED"; fullName?: string; companyName?: string; email?: string } = {}) {
  enquiryCounter += 1;
  return db.enquiry.create({
    data: {
      reference: `AQ-2026-9${String(enquiryCounter).padStart(5, "0")}`,
      type: "AROMA_CHEMICALS",
      status: data.status ?? "NEW",
      fullName: data.fullName ?? "TEST Jane Buyer",
      companyName: data.companyName ?? "TEST Fragrance House Ltd",
      email: data.email ?? "jane@testfragrance.example",
      consentAt: new Date(),
      ipHash: "TEST-ip-hash-must-not-leak",
      userAgent: "TEST-agent-must-not-leak",
      items: {
        create: [{ productNameSnapshot: "TEST-Ethanol", casSnapshot: "64-17-5", quantity: "25.000", unit: "KG", notes: "TEST note" }],
      },
      activities: { create: { action: "enquiry.created", detail: { source: "rfq-form", items: 1, attachments: 0 } } },
    },
  });
}

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-admin-"));
  await resetDb();
  for (const role of ROLES) {
    const { id } = await createCredentialUser({ email: emailFor(role), password: passwordFor(role), role });
    userIds.set(role, id);
    const { headers } = await auth.api.signInEmail({
      body: { email: emailFor(role), password: passwordFor(role) },
      returnHeaders: true,
    });
    cookies.set(
      role,
      headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    );
  }
});

afterAll(async () => {
  await rm(state.root, { recursive: true, force: true });
});

beforeEach(async () => {
  // Keep the users and sessions; reset everything the tests touch.
  await db.enquiry.deleteMany();
  await db.product.deleteMany();
  await db.siteSetting.deleteMany();
  signedInAs(null);
  vi.restoreAllMocks();
});

describe("setProductStatus", () => {
  it("redirects an unauthenticated caller to the login page and changes nothing", async () => {
    const p = await makeProduct("test-a", { verified: true });
    await expectLoginRedirect(() => setProductStatus(p.id, "PUBLISHED"));
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DRAFT");
  });

  it.each(DENIED)("refuses a %s session with a 403 and changes nothing", async (role) => {
    const p = await makeProduct("test-a", { verified: true });
    signedInAs(role);
    await expectForbidden(() => setProductStatus(p.id, "PUBLISHED"));
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DRAFT");
  });

  it("will not publish an unverified product and leaves it unchanged", async () => {
    const p = await makeProduct("test-unverified");
    signedInAs("SALES_MANAGER");
    const result = await setProductStatus(p.id, "PUBLISHED");
    expect(result).toEqual({ ok: false, error: UNVERIFIED_ERROR });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ status: "DRAFT", publishedAt: null, updatedAt: p.updatedAt });
  });

  it("publishes a verified product and sets publishedAt", async () => {
    const p = await makeProduct("test-verified", { verified: true });
    signedInAs("SALES_MANAGER");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const before = Date.now();
    expect(await setProductStatus(p.id, "PUBLISHED")).toEqual({ ok: true });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe("PUBLISHED");
    expect(row.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);

    // Audit line: structured, with the actor id, no email address.
    const lines = info.mock.calls.map((c) => c.join(" "));
    const audit = lines.find((l) => l.includes("[admin.audit]") && l.includes("product.status"));
    expect(audit).toBeDefined();
    expect(audit).toContain(userIds.get("SALES_MANAGER"));
    expect(audit).toContain(p.id);
    expect(audit).toContain('"from":"DRAFT"');
    expect(audit).toContain('"to":"PUBLISHED"');
    expect(audit).not.toContain("@");
  });

  it("sets publishedAt to now on every publish, including a republish", async () => {
    const old = new Date(Date.UTC(2020, 0, 1));
    const p = await makeProduct("test-republish", { verified: true, publishedAt: old });
    signedInAs("SUPER_ADMIN");
    expect(await setProductStatus(p.id, "PUBLISHED")).toEqual({ ok: true });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.publishedAt!.getTime()).toBeGreaterThan(old.getTime());
  });

  it("refuses a product whose name was emptied behind the app's back", async () => {
    const p = await makeProduct("test-empty-name", { verified: true });
    await db.$executeRaw`UPDATE "product" SET "name" = '' WHERE "id" = ${p.id}::uuid`;
    signedInAs("SALES_MANAGER");
    expect(await setProductStatus(p.id, "PUBLISHED")).toEqual({ ok: false, error: PUBLISH_REQUIREMENTS_ERROR });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DRAFT");
  });

  it("recognises the database CHECK violation as the backstop for the publish rule", async () => {
    const p = await makeProduct("test-check", { verified: true });
    await db.$executeRaw`UPDATE "product" SET "name" = '' WHERE "id" = ${p.id}::uuid`;
    const error = await db.product.update({ where: { id: p.id }, data: { status: "PUBLISHED" } }).catch((e: unknown) => e);
    expect(isPublishCheckViolation(error)).toBe(true);
    expect(isPublishCheckViolation(new Error("something else"))).toBe(false);
    expect(isPublishCheckViolation(null)).toBe(false);
  });

  it("unpublishes to DRAFT and archives, keeping the last publish date", async () => {
    const at = new Date(Date.UTC(2026, 0, 1));
    const a = await makeProduct("test-unpub", { status: "PUBLISHED", verified: true, publishedAt: at });
    const b = await makeProduct("test-arch", { status: "PUBLISHED", verified: true, publishedAt: at });
    signedInAs("SALES_MANAGER");
    expect(await setProductStatus(a.id, "DRAFT")).toEqual({ ok: true });
    expect(await setProductStatus(b.id, "ARCHIVED")).toEqual({ ok: true });
    expect(await db.product.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "DRAFT", verified: true, publishedAt: at });
    expect(await db.product.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "ARCHIVED", publishedAt: at });
    // An archived product can be restored to draft.
    expect(await setProductStatus(b.id, "DRAFT")).toEqual({ ok: true });
  });

  it("rejects invalid ids and statuses without touching the database", async () => {
    const p = await makeProduct("test-valid", { verified: true });
    signedInAs("SUPER_ADMIN");
    for (const id of ["", "not-a-uuid", "'; DROP TABLE product; --", `${p.id}x`]) {
      expect(await setProductStatus(id, "PUBLISHED"), id).toEqual({ ok: false, error: expect.any(String) });
    }
    for (const status of ["LIVE", "", "published", null, 1]) {
      expect(
        await setProductStatus(p.id, status as unknown as "PUBLISHED"),
        String(status),
      ).toEqual({ ok: false, error: expect.any(String) });
    }
    expect(await setProductStatus("00000000-0000-4000-8000-000000000000", "DRAFT")).toEqual({
      ok: false,
      error: "Product not found.",
    });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DRAFT");
  });

  it("checks the session before validating input", async () => {
    signedInAs("CONTENT_EDITOR");
    await expectForbidden(() => setProductStatus("not-a-uuid", "LIVE" as unknown as "DRAFT"));
  });
});

describe("setProductVerified", () => {
  it("is not permitted for a SALES_MANAGER, and the refusal is audited", async () => {
    const p = await makeProduct("test-v");
    signedInAs("SALES_MANAGER");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await setProductVerified(p.id, true)).toEqual({ ok: false, error: "Not permitted" });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).verified).toBe(false);
    const audit = info.mock.calls.map((c) => c.join(" ")).find((l) => l.includes("product.verified"));
    expect(audit).toContain('"outcome":"denied"');
    expect(audit).toContain(userIds.get("SALES_MANAGER"));
  });

  it.each(DENIED)("refuses a %s session with a 403", async (role) => {
    const p = await makeProduct("test-v");
    signedInAs(role);
    await expectForbidden(() => setProductVerified(p.id, true));
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).verified).toBe(false);
  });

  it("redirects an unauthenticated caller", async () => {
    const p = await makeProduct("test-v");
    await expectLoginRedirect(() => setProductVerified(p.id, true));
  });

  it("lets a SUPER_ADMIN mark a product verified and unverified", async () => {
    const p = await makeProduct("test-v");
    signedInAs("SUPER_ADMIN");
    expect(await setProductVerified(p.id, true)).toEqual({ ok: true });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).verified).toBe(true);
    expect(await setProductVerified(p.id, false)).toEqual({ ok: true });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).verified).toBe(false);
  });

  it("unpublishes a PUBLISHED product in the same change when it is unverified", async () => {
    const p = await makeProduct("test-live", { status: "PUBLISHED", verified: true, publishedAt: new Date() });
    signedInAs("SUPER_ADMIN");
    expect(await setProductVerified(p.id, false)).toEqual({ ok: true });
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ verified: false, status: "DRAFT" });
  });

  it("rejects invalid input", async () => {
    signedInAs("SUPER_ADMIN");
    expect(await setProductVerified("nope", true)).toEqual({ ok: false, error: expect.any(String) });
    const p = await makeProduct("test-v");
    expect(await setProductVerified(p.id, "yes" as unknown as boolean)).toEqual({ ok: false, error: expect.any(String) });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).verified).toBe(false);
  });
});

describe("admin product list", () => {
  it("includes drafts and archived products (with internal fields), while the public queries do not", async () => {
    await makeProduct("test-draft");
    await makeProduct("test-archived", { status: "ARCHIVED" });
    await makeProduct("test-live", { status: "PUBLISHED", verified: true, publishedAt: new Date() });

    const admin = await listAdminProducts({});
    expect(admin.total).toBe(3);
    expect(admin.items.map((i) => i.slug).sort()).toEqual(["test-archived", "test-draft", "test-live"]);
    expect(admin.items.find((i) => i.slug === "test-draft")).toMatchObject({
      status: "DRAFT",
      verified: false,
      sourceNote: "TEST-legacy, unverified",
    });

    const pub = await searchProducts({});
    expect(pub.items.map((i) => i.slug)).toEqual(["test-live"]);
  });

  it("filters by status and searches name, code and CAS", async () => {
    await makeProduct("test-draft");
    await db.product.create({
      data: { name: "TEST-Ethanol", slug: "test-ethanol", casNumber: "64-17-5", casNormalized: "64175", code: "TEST-ETH" },
    });
    expect((await listAdminProducts({ status: "DRAFT" })).total).toBe(2);
    expect((await listAdminProducts({ status: "PUBLISHED" })).total).toBe(0);
    expect((await listAdminProducts({ q: "64-17-5" })).items.map((i) => i.slug)).toEqual(["test-ethanol"]);
    expect((await listAdminProducts({ q: "64175" })).items.map((i) => i.slug)).toEqual(["test-ethanol"]);
    expect((await listAdminProducts({ q: "eth" })).items.map((i) => i.slug)).toEqual(["test-ethanol"]);
    expect((await listAdminProducts({ q: "TEST-TEST-DRAFT" })).items.map((i) => i.slug)).toEqual(["test-draft"]);
    expect((await listAdminProducts({ q: "100%" })).total).toBe(0);
  });
});

describe("setEnquiryStatus", () => {
  it("writes exactly one status.changed activity with from, to and the actor", async () => {
    const e = await makeEnquiry();
    signedInAs("SALES_MANAGER");
    expect(await setEnquiryStatus(e.id, "CONTACTED")).toEqual({ ok: true });
    expect((await db.enquiry.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("CONTACTED");
    const rows = await db.enquiryActivity.findMany({ where: { enquiryId: e.id, action: "status.changed" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: userIds.get("SALES_MANAGER"), detail: { from: "NEW", to: "CONTACTED" } });
  });

  it("writes nothing when the status is unchanged", async () => {
    const e = await makeEnquiry({ status: "CONTACTED" });
    signedInAs("SUPER_ADMIN");
    expect(await setEnquiryStatus(e.id, "CONTACTED")).toEqual({ ok: true });
    expect(await db.enquiryActivity.count({ where: { enquiryId: e.id, action: "status.changed" } })).toBe(0);
  });

  it.each(DENIED)("refuses a %s session with a 403 and writes nothing", async (role) => {
    const e = await makeEnquiry();
    signedInAs(role);
    await expectForbidden(() => setEnquiryStatus(e.id, "WON"));
    expect((await db.enquiry.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("NEW");
    expect(await db.enquiryActivity.count({ where: { enquiryId: e.id, action: "status.changed" } })).toBe(0);
  });

  it("redirects an unauthenticated caller", async () => {
    const e = await makeEnquiry();
    await expectLoginRedirect(() => setEnquiryStatus(e.id, "WON"));
  });

  it("rejects invalid ids and statuses", async () => {
    const e = await makeEnquiry();
    signedInAs("SALES_MANAGER");
    expect(await setEnquiryStatus("nope", "WON")).toEqual({ ok: false, error: expect.any(String) });
    expect(await setEnquiryStatus(e.id, "DONE" as unknown as "WON")).toEqual({ ok: false, error: expect.any(String) });
    expect(await setEnquiryStatus("00000000-0000-4000-8000-000000000000", "WON")).toEqual({
      ok: false,
      error: "Enquiry not found.",
    });
    expect((await db.enquiry.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("NEW");
  });
});

describe("enquiry queries", () => {
  it("lists newest first, filters by status and searches reference, name, company and email; never selects ipHash or userAgent", async () => {
    const a = await makeEnquiry({ fullName: "TEST Alice Able", companyName: "TEST Acme", email: "alice@acme.example" });
    const b = await makeEnquiry({ status: "CONTACTED", fullName: "TEST Bob Baker", companyName: "TEST Bakery", email: "bob@bakery.example" });
    const all = await listEnquiries({});
    expect(all.items.map((i) => i.id)).toEqual([b.id, a.id]);
    for (const item of all.items) {
      expect(Object.keys(item)).not.toContain("ipHash");
      expect(Object.keys(item)).not.toContain("userAgent");
    }
    expect((await listEnquiries({ status: "CONTACTED" })).items.map((i) => i.id)).toEqual([b.id]);
    expect((await listEnquiries({ q: a.reference })).items.map((i) => i.id)).toEqual([a.id]);
    expect((await listEnquiries({ q: "bob baker" })).items.map((i) => i.id)).toEqual([b.id]);
    expect((await listEnquiries({ q: "acme" })).items.map((i) => i.id)).toEqual([a.id]);
    expect((await listEnquiries({ q: "BOB@BAKERY" })).items.map((i) => i.id)).toEqual([b.id]);
    expect((await listEnquiries({ q: "%" })).total).toBe(0);
  });

  it("paginates 25 per page", async () => {
    for (let i = 0; i < 27; i++) await makeEnquiry();
    const first = await listEnquiries({});
    expect(first).toMatchObject({ total: 27, pageCount: 2, page: 1 });
    expect(first.items).toHaveLength(25);
    expect((await listEnquiries({ page: 2 })).items).toHaveLength(2);
  });

  it("returns the detail without ipHash, userAgent or storage keys", async () => {
    const e = await makeEnquiry();
    await db.enquiryAttachment.create({
      data: { enquiryId: e.id, filename: "TEST.pdf", mimeType: "application/pdf", sizeBytes: 10, storageKey: "TEST-secret-key" },
    });
    const detail = await getEnquiry(e.id);
    const json = JSON.stringify(detail);
    expect(detail?.reference).toBe(e.reference);
    expect(detail?.items[0]).toMatchObject({ productNameSnapshot: "TEST-Ethanol", casSnapshot: "64-17-5", unit: "KG" });
    expect(detail?.attachments[0]).toMatchObject({ filename: "TEST.pdf", sizeBytes: 10 });
    for (const secret of ["TEST-ip-hash-must-not-leak", "TEST-agent-must-not-leak", "TEST-secret-key"]) {
      expect(json).not.toContain(secret);
    }
    expect(await getEnquiry("nope")).toBeNull();
  });

  it("reports enquiry types with no valid notification recipients", async () => {
    expect(await missingRecipientTypes()).toEqual(["FRAGRANCES", "AROMA_CHEMICALS", "FLAVOURS", "GENERAL", "CAREERS"]);
    await db.siteSetting.createMany({
      data: [
        { key: "notification.recipients.AROMA_CHEMICALS", value: ["sales@example.test"] },
        { key: "notification.recipients.FLAVOURS", value: ["not an email"] },
      ],
    });
    expect(await missingRecipientTypes()).toEqual(["FRAGRANCES", "FLAVOURS", "GENERAL", "CAREERS"]);
  });
});

describe("attachment download route", () => {
  const BYTES = Buffer.from("%PDF-1.4\n% TEST attachment bytes \u{00e9}\n%%EOF\n");
  const KEY = "TEST-attachment-storage-key-0001";

  async function makeAttachment(withFile = true) {
    const e = await makeEnquiry();
    const a = await db.enquiryAttachment.create({
      data: { enquiryId: e.id, filename: "TEST-spec.pdf", mimeType: "application/pdf", sizeBytes: BYTES.length, storageKey: KEY },
    });
    if (withFile) await writeFile(path.join(state.root, KEY), BYTES);
    else await rm(path.join(state.root, KEY), { force: true });
    return { enquiry: e, attachment: a };
  }

  function get(id: string, role: Role | null) {
    const headers = new Headers(role ? { cookie: cookies.get(role) ?? "" } : {});
    return downloadAttachment(new Request(`http://localhost:3000/api/admin/attachments/${encodeURIComponent(id)}`, { headers }), {
      params: Promise.resolve({ id }),
    });
  }

  async function expectNoKey(res: Response) {
    const body = Buffer.from(await res.arrayBuffer()).toString("latin1");
    expect(body).not.toContain(KEY);
    for (const [, value] of res.headers) expect(value).not.toContain(KEY);
  }

  it("returns 401 with no body without a session", async () => {
    const { attachment } = await makeAttachment();
    const res = await get(attachment.id, null);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("returns 401 for a forged session cookie", async () => {
    const { attachment } = await makeAttachment();
    const res = await downloadAttachment(
      new Request("http://localhost:3000/x", { headers: { cookie: "better-auth.session_token=forged.value" } }),
      { params: Promise.resolve({ id: attachment.id }) },
    );
    expect(res.status).toBe(401);
  });

  it.each(DENIED)("returns 403 with no body for a %s session", async (role) => {
    const { attachment } = await makeAttachment();
    const res = await get(attachment.id, role);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("");
    expect(await db.enquiryActivity.count({ where: { action: "attachment.downloaded" } })).toBe(0);
  });

  it("returns 404 for unknown ids, non-uuids and a missing file", async () => {
    const { attachment } = await makeAttachment(false);
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid", "../../etc/passwd", attachment.id]) {
      const res = await get(id, "SALES_MANAGER");
      expect(res.status, id).toBe(404);
      await expectNoKey(res);
    }
    expect(await db.enquiryActivity.count({ where: { action: "attachment.downloaded" } })).toBe(0);
  });

  it.each(["SALES_MANAGER", "SUPER_ADMIN"] as const)(
    "streams the exact bytes with safe headers for %s and logs the download",
    async (role) => {
      const { attachment, enquiry } = await makeAttachment();
      const res = await get(attachment.id.toUpperCase(), role);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
      expect(res.headers.get("content-disposition")).toBe(
        `attachment; filename="TEST-spec.pdf"; filename*=UTF-8''TEST-spec.pdf`,
      );
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("content-security-policy")).toContain("sandbox");
      const body = Buffer.from(await res.clone().arrayBuffer());
      expect(body.equals(BYTES)).toBe(true);
      await expectNoKey(res);

      const logged = await db.enquiryActivity.findMany({ where: { enquiryId: enquiry.id, action: "attachment.downloaded" } });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toMatchObject({ actorId: userIds.get(role), detail: { attachmentId: attachment.id } });
    },
  );

  // Next.js would otherwise answer HEAD by running GET (writing a phantom
  // download record). HEAD gets the same auth answers first, then 405.
  function head(id: string, role: Role | null) {
    const headers = new Headers(role ? { cookie: cookies.get(role) ?? "" } : {});
    return headAttachment(
      new Request(`http://localhost:3000/api/admin/attachments/${encodeURIComponent(id)}`, { method: "HEAD", headers }),
    );
  }

  it("HEAD as an allowed role answers 405 Allow: GET and records nothing", async () => {
    const { attachment } = await makeAttachment();
    const before = await db.enquiryActivity.count();
    for (const role of ["SALES_MANAGER", "SUPER_ADMIN"] as const) {
      const res = await head(attachment.id, role);
      expect(res.status, role).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
      expect(await res.text()).toBe("");
      await expectNoKey(res);
    }
    expect(await db.enquiryActivity.count()).toBe(before);
    expect(await db.enquiryActivity.count({ where: { action: "attachment.downloaded" } })).toBe(0);
  });

  it("HEAD keeps the auth answers: 401 signed out (and forged), 403 for a denied role", async () => {
    const { attachment } = await makeAttachment();
    expect((await head(attachment.id, null)).status).toBe(401);
    const forged = await headAttachment(
      new Request("http://localhost:3000/x", { method: "HEAD", headers: { cookie: "better-auth.session_token=forged.value" } }),
    );
    expect(forged.status).toBe(401);
    for (const role of DENIED) expect((await head(attachment.id, role)).status, role).toBe(403);
  });

  it("GET refuses a cross-site request (Sec-Fetch-Site) after the auth check; same-origin and header-less work", async () => {
    const { attachment } = await makeAttachment();
    const withSite = (site: string | null, role: Role | null) => {
      const headers = new Headers(role ? { cookie: cookies.get(role) ?? "" } : {});
      if (site) headers.set("sec-fetch-site", site);
      return downloadAttachment(new Request(`http://localhost:3000/api/admin/attachments/${attachment.id}`, { headers }), {
        params: Promise.resolve({ id: attachment.id }),
      });
    };
    expect((await withSite("cross-site", null)).status).toBe(401);
    const cross = await withSite("cross-site", "SALES_MANAGER");
    expect(cross.status).toBe(403);
    expect(await cross.text()).toBe("");
    expect(await db.enquiryActivity.count({ where: { action: "attachment.downloaded" } })).toBe(0);

    for (const site of ["same-origin", "none", null]) {
      const res = await withSite(site, "SALES_MANAGER");
      expect(res.status, String(site)).toBe(200);
      await res.arrayBuffer();
    }
    expect(await db.enquiryActivity.count({ where: { action: "attachment.downloaded" } })).toBe(3);
  });
});
