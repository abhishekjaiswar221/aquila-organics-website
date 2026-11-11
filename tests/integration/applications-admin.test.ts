import { mkdtemp, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";
import { db, resetDb } from "./setup";

// Real users, sessions and requireAction(); fakes are the request headers, a
// temp-dir LocalStorage (optionally failing deletes), the email provider and an
// audit writer that can be made to fail.
const state = vi.hoisted(() => ({
  headers: new Headers(),
  root: "",
  failDelete: false,
  failAudit: false,
  sent: [] as EmailMessage[],
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => state.headers,
}));

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  refresh: vi.fn(),
}));

vi.mock("@/features/admin/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/audit")>();
  return {
    ...actual,
    recordAudit: (...args: Parameters<typeof actual.recordAudit>) =>
      state.failAudit ? Promise.reject(new Error("audit write failed")) : actual.recordAudit(...args),
  };
});

vi.mock("@/lib/storage", async () => {
  const { LocalStorage } = await import("@/lib/storage/local");
  return {
    getStorage: () => {
      const real = new LocalStorage(state.root);
      return {
        put: real.put.bind(real),
        getStream: real.getStream.bind(real),
        delete: async (key: string) => {
          if (state.failDelete) throw new Error("storage down");
          return real.delete(key);
        },
      };
    },
  };
});

vi.mock("@/lib/email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...original,
    getEmailProvider: () => ({
      send: async (msg: EmailMessage) => {
        state.sent.push(msg);
      },
    }),
  };
});

const { auth } = await import("@/lib/auth");
const { createCredentialUser } = await import("@/lib/admin-seed");
const { listApplications, getApplication, getApplicationCv } = await import("@/features/careers/application-queries");
const { setApplicationStatus, deleteApplication } = await import("@/features/careers/application-actions");
const { GET: downloadCv, HEAD: headCv } = await import("@/app/api/admin/applications/[id]/cv/route");
const { saveRecipients } = await import("@/features/settings/actions");
const { submitApplication } = await import("@/features/careers/actions");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "SALES_EXECUTIVE" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "SALES_EXECUTIVE", "CONTENT_EDITOR", "HR_MANAGER"];
const ALLOWED = ["HR_MANAGER", "SUPER_ADMIN"] as const;
const DENIED = ["ADMINISTRATOR", "SALES_MANAGER", "SALES_EXECUTIVE", "CONTENT_EDITOR"] as const;
const cookies = new Map<Role, string>();
const userIds = new Map<Role, string>();

const emailFor = (role: Role) => `apps-${role.toLowerCase().replace(/_/g, "-")}@admin.example.test`;
const passwordFor = (role: Role) => `TEST-${role.toLowerCase()}-apps-passphrase`;

function signedInAs(role: Role | null): void {
  state.headers = role ? new Headers({ cookie: cookies.get(role) ?? "" }) : new Headers();
}

const digestOf = (e: unknown) => (e instanceof Error && "digest" in e ? String(e.digest) : String(e));
const rejection = (run: () => Promise<unknown>) =>
  run().then(
    () => "resolved",
    (e: unknown) => digestOf(e),
  );

// Candidate data that must never reach AuditLog or console output.
const NAME = "TEST Casey Candidate";
const EMAIL = "casey.candidate@testmail.example";
const PHONE = "+44 20 7946 0999";
const MESSAGE = "TEST-Message: I admire your work";
const CV_NAME = "Casey-Candidate-CV.pdf";
const KEY_PREFIX = "cv-TEST-storage-key-";
const IP_HASH = "TEST-ip-hash-value";
const UA = "TEST-ua-string/9.9";
const PDF = Buffer.from("%PDF-1.4\n% TEST applicant CV\n%%EOF\n");

let seq = 0;
async function makeApp(
  opts: { status?: "NEW" | "REVIEWING" | "HIRED"; jobId?: string | null; title?: string; withFile?: boolean; createdAt?: Date } = {},
) {
  seq += 1;
  const key = `${KEY_PREFIX}${seq.toString().padStart(4, "0")}`;
  const app = await db.jobApplication.create({
    data: {
      reference: `CA-2026-${String(900000 + seq)}`,
      jobId: opts.jobId ?? null,
      jobTitleSnapshot: opts.title ?? "General application",
      fullName: NAME,
      email: EMAIL,
      phone: PHONE,
      country: "United Kingdom",
      message: MESSAGE,
      consentAt: new Date(),
      ipHash: IP_HASH,
      userAgent: UA,
      status: opts.status ?? "NEW",
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      ...(opts.withFile === false
        ? {}
        : {
            files: {
              create: { filename: CV_NAME, mimeType: "application/pdf", sizeBytes: PDF.length, storageKey: key },
            },
          }),
    },
  });
  if (opts.withFile !== false) {
    await mkdir(state.root, { recursive: true });
    await writeFile(path.join(state.root, key), PDF);
  }
  return { app, key };
}

const makeJob = (slug: string) =>
  db.jobOpening.create({
    data: { slug, title: `TEST Title ${slug}`, location: "Mumbai", employmentType: "FULL_TIME", summary: "s", description: "d" },
  });

const objects = () => readdir(state.root).catch(() => [] as string[]);
const auditFor = (action: string) => db.auditLog.findMany({ where: { action }, orderBy: { at: "asc" } });

function statusForm(id: string, status: string, from: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("status", status);
  fd.set("from", from);
  return fd;
}
function idForm(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

async function expectNoPersonalData() {
  const dump = JSON.stringify(await db.auditLog.findMany());
  for (const secret of [NAME, "Casey", EMAIL, "casey.candidate", PHONE, MESSAGE, CV_NAME, KEY_PREFIX, IP_HASH, UA]) {
    expect(dump).not.toContain(secret);
  }
}

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-applications-"));
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
  await db.auditLog.deleteMany();
  await db.jobApplication.deleteMany();
  await db.jobOpening.deleteMany();
  await db.siteSetting.deleteMany();
  await db.rateLimitHit.deleteMany();
  await rm(state.root, { recursive: true, force: true });
  state.failDelete = false;
  state.failAudit = false;
  state.sent = [];
  signedInAs("HR_MANAGER");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listApplications", () => {
  it("filters by status and by opening, and returns only the list fields", async () => {
    const jobA = await makeJob("a");
    const jobB = await makeJob("b");
    await makeApp({ jobId: jobA.id, title: "TEST Title a" });
    await makeApp({ jobId: jobA.id, status: "REVIEWING", title: "TEST Title a" });
    await makeApp({ jobId: jobB.id, status: "REVIEWING", title: "TEST Title b", withFile: false });

    expect((await listApplications({})).total).toBe(3);
    expect((await listApplications({ status: "REVIEWING" })).total).toBe(2);
    expect((await listApplications({ jobId: jobA.id })).total).toBe(2);
    const both = await listApplications({ status: "REVIEWING", jobId: jobB.id });
    expect(both.total).toBe(1);
    expect(both.items[0]).toMatchObject({
      fullName: NAME,
      email: EMAIL,
      jobTitleSnapshot: "TEST Title b",
      status: "REVIEWING",
      fileCount: 0,
    });
    expect(Object.keys(both.items[0]).sort()).toEqual(
      ["createdAt", "email", "fileCount", "fullName", "id", "jobTitleSnapshot", "reference", "status"].sort(),
    );
    const dump = JSON.stringify(await listApplications({}));
    for (const secret of [KEY_PREFIX, IP_HASH, UA]) expect(dump).not.toContain(secret);
    // An invalid filter value is ignored rather than throwing.
    expect((await listApplications({ jobId: "not-a-uuid" })).total).toBe(3);
  });

  it("paginates 25 per page, newest first", async () => {
    for (let i = 0; i < 26; i++) {
      await makeApp({ withFile: false, createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)) });
    }
    const first = await listApplications({ page: 1 });
    expect(first).toMatchObject({ total: 26, page: 1, pageCount: 2 });
    expect(first.items).toHaveLength(25);
    expect(first.items[0].createdAt.getTime()).toBeGreaterThan(first.items[24].createdAt.getTime());
    const second = await listApplications({ page: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.items[0].createdAt.getTime()).toBe(Date.UTC(2026, 0, 1, 0, 0));
  });
});

describe("getApplication and getApplicationCv", () => {
  it("returns the details and file metadata but never the storage key, ip hash or user agent", async () => {
    const { app, key } = await makeApp();
    const detail = await getApplication(app.id.toUpperCase());
    expect(detail).toMatchObject({ fullName: NAME, email: EMAIL, phone: PHONE, message: MESSAGE, status: "NEW" });
    expect(detail?.files).toEqual([
      { id: expect.any(String), filename: CV_NAME, sizeBytes: PDF.length, mimeType: "application/pdf" },
    ]);
    const dump = JSON.stringify(detail);
    for (const secret of [key, KEY_PREFIX, "storageKey", IP_HASH, UA, "ipHash", "userAgent"]) {
      expect(dump).not.toContain(secret);
    }
    expect(await getApplication("not-a-uuid")).toBeNull();
    expect(await getApplication("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("getApplicationCv returns the first file's key for the route only", async () => {
    const { app, key } = await makeApp();
    expect(await getApplicationCv(app.id)).toMatchObject({
      applicationId: app.id,
      storageKey: key,
      mimeType: "application/pdf",
      filename: CV_NAME,
    });
    const none = await makeApp({ withFile: false });
    expect(await getApplicationCv(none.app.id)).toBeNull();
    expect(await getApplicationCv("nope")).toBeNull();
  });
});

describe("setApplicationStatus", () => {
  it.each(ALLOWED)("lets %s change the status and audits {from,to} with the id only", async (role) => {
    signedInAs(role);
    const { app } = await makeApp();
    const result = await setApplicationStatus(null, statusForm(app.id, "REVIEWING", "NEW"));
    expect(result).toEqual({ ok: true, message: "Status saved: Reviewing." });
    expect((await db.jobApplication.findUnique({ where: { id: app.id } }))?.status).toBe("REVIEWING");
    const rows = await auditFor("application.status");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: userIds.get(role),
      actorRole: role,
      entityType: "application",
      entityId: app.id,
      outcome: "ok",
      detail: { from: "NEW", to: "REVIEWING" },
    });
    await expectNoPersonalData();
  });

  it("rejects a stale `from` with a clear message, changes nothing and audits nothing", async () => {
    const { app } = await makeApp({ status: "REVIEWING" });
    const result = await setApplicationStatus(null, statusForm(app.id, "HIRED", "NEW"));
    expect(result).toEqual({
      ok: false,
      message: "The status was changed by someone else meanwhile. Reload the page and try again.",
    });
    expect((await db.jobApplication.findUnique({ where: { id: app.id } }))?.status).toBe("REVIEWING");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("setting the current status writes no audit row; bad input is refused", async () => {
    const { app } = await makeApp();
    expect(await setApplicationStatus(null, statusForm(app.id, "NEW", "NEW"))).toMatchObject({ ok: true });
    expect(await db.auditLog.count()).toBe(0);
    expect(await setApplicationStatus(null, statusForm(app.id, "BOGUS", "NEW"))).toMatchObject({ ok: false });
    expect(await setApplicationStatus(null, statusForm(app.id, "HIRED", "BOGUS"))).toMatchObject({ ok: false });
    expect(await setApplicationStatus(null, statusForm("not-a-uuid", "HIRED", "NEW"))).toEqual({
      ok: false,
      message: "Application not found.",
    });
    expect(
      await setApplicationStatus(null, statusForm("00000000-0000-4000-8000-000000000000", "HIRED", "NEW")),
    ).toEqual({ ok: false, message: "Application not found." });
    expect((await db.jobApplication.findUnique({ where: { id: app.id } }))?.status).toBe("NEW");
  });

  it("rolls the status back when the audit row cannot be written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = await makeApp();
    state.failAudit = true;
    const result = await setApplicationStatus(null, statusForm(app.id, "HIRED", "NEW"));
    expect(result).toMatchObject({ ok: false });
    expect((await db.jobApplication.findUnique({ where: { id: app.id } }))?.status).toBe("NEW");
  });
});

describe("deleteApplication", () => {
  it.each(ALLOWED)("lets %s delete: rows and stored object go, one audit row with the file count only", async (role) => {
    signedInAs(role);
    const { app } = await makeApp();
    expect(await objects()).toHaveLength(1);
    const result = await deleteApplication(null, idForm(app.id));
    expect(result).toEqual({ ok: true, message: "Application deleted." });
    expect(await db.jobApplication.count()).toBe(0);
    expect(await db.applicationFile.count()).toBe(0);
    expect(await objects()).toEqual([]);
    const rows = await auditFor("application.delete");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: userIds.get(role),
      entityType: "application",
      entityId: app.id,
      outcome: "ok",
      detail: { files: 1 },
    });
    await expectNoPersonalData();
  });

  it("a storage failure still deletes the rows, is logged by class name and audited", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = await makeApp();
    state.failDelete = true;
    const result = await deleteApplication(null, idForm(app.id));
    expect(result).toMatchObject({ ok: true });
    expect(await db.jobApplication.count()).toBe(0);
    expect(await db.applicationFile.count()).toBe(0);
    const rows = await auditFor("application.delete");
    expect(rows.map((r) => r.detail)).toEqual([{ files: 1 }, { storageCleanup: "failed" }]);
    const logged = JSON.stringify(errors.mock.calls);
    for (const secret of [KEY_PREFIX, NAME, EMAIL, "storage down"]) expect(logged).not.toContain(secret);
    expect(logged).toContain("Error");
    await expectNoPersonalData();
  });

  it("rolls everything back when the audit row cannot be written (rows and object stay)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = await makeApp();
    state.failAudit = true;
    expect(await deleteApplication(null, idForm(app.id))).toMatchObject({ ok: false });
    expect(await db.jobApplication.count()).toBe(1);
    expect(await db.applicationFile.count()).toBe(1);
    expect(await objects()).toHaveLength(1);
  });

  it("answers not found for a bad or unknown id and writes nothing", async () => {
    for (const id of ["not-a-uuid", "00000000-0000-4000-8000-000000000000"]) {
      expect(await deleteApplication(null, idForm(id))).toEqual({ ok: false, message: "Application not found." });
    }
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("access to the actions", () => {
  it.each(DENIED)("%s gets a 403 digest from every action and nothing changes", async (role) => {
    const { app } = await makeApp();
    signedInAs(role);
    expect(await rejection(() => setApplicationStatus(null, statusForm(app.id, "HIRED", "NEW")))).toBe(
      "NEXT_HTTP_ERROR_FALLBACK;403",
    );
    expect(await rejection(() => deleteApplication(null, idForm(app.id)))).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await db.jobApplication.count()).toBe(1);
    expect((await db.jobApplication.findUnique({ where: { id: app.id } }))?.status).toBe("NEW");
    expect(await objects()).toHaveLength(1);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("a signed-out caller is redirected to the login page by every action", async () => {
    const { app } = await makeApp();
    signedInAs(null);
    for (const run of [
      () => setApplicationStatus(null, statusForm(app.id, "HIRED", "NEW")),
      () => deleteApplication(null, idForm(app.id)),
    ]) {
      expect(await rejection(run)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);
    }
    expect(await db.jobApplication.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("CV download route", () => {
  function get(id: string, role: Role | null, extra: Record<string, string> = {}) {
    const headers = new Headers(role ? { cookie: cookies.get(role) ?? "" } : {});
    for (const [k, v] of Object.entries(extra)) headers.set(k, v);
    return downloadCv(new Request(`http://localhost:3000/api/admin/applications/${encodeURIComponent(id)}/cv`, { headers }), {
      params: Promise.resolve({ id }),
    });
  }
  function head(id: string, role: Role | null) {
    const headers = new Headers(role ? { cookie: cookies.get(role) ?? "" } : {});
    return headCv(
      new Request(`http://localhost:3000/api/admin/applications/${encodeURIComponent(id)}/cv`, { method: "HEAD", headers }),
    );
  }
  async function expectNoKey(res: Response, key: string) {
    const body = Buffer.from(await res.arrayBuffer()).toString("latin1");
    expect(body).not.toContain(key);
    for (const [, value] of res.headers) expect(value).not.toContain(key);
  }

  it("returns 401 with no body without a session, and for a forged cookie", async () => {
    const { app } = await makeApp();
    const res = await get(app.id, null);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
    const forged = await get(app.id, null, { cookie: "better-auth.session_token=forged.value" });
    expect(forged.status).toBe(401);
    expect(await db.auditLog.count()).toBe(0);
  });

  it.each(DENIED)("returns 403 with no body for a %s session and audits nothing", async (role) => {
    const { app } = await makeApp();
    const res = await get(app.id, role);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("returns 404 for non-uuid, unknown, no-file and missing-object cases, and never leaks the key", async () => {
    const noFile = await makeApp({ withFile: false });
    const missing = await makeApp();
    await rm(path.join(state.root, missing.key), { force: true });
    for (const [id, key] of [
      ["00000000-0000-4000-8000-000000000000", KEY_PREFIX],
      ["not-a-uuid", KEY_PREFIX],
      ["../../etc/passwd", KEY_PREFIX],
      [noFile.app.id, KEY_PREFIX],
      [missing.app.id, missing.key],
    ]) {
      const res = await get(id, "HR_MANAGER");
      expect(res.status, id).toBe(404);
      await expectNoKey(res, key);
    }
    expect(await db.auditLog.count()).toBe(0);
  });

  it.each(ALLOWED)("streams the exact bytes with safe headers for %s and audits first", async (role) => {
    const { app, key } = await makeApp();
    const res = await get(app.id.toUpperCase(), role);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="${CV_NAME}"; filename*=UTF-8''${CV_NAME}`,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");

    // The audit row exists before the body is consumed.
    const rows = await auditFor("application.cv-download");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: userIds.get(role), entityType: "application", entityId: app.id, outcome: "ok" });

    const body = Buffer.from(await res.clone().arrayBuffer());
    expect(body.equals(PDF)).toBe(true);
    await expectNoKey(res, key);
    await expectNoPersonalData();
  });

  it("serves a safe filename even when the stored one is hostile", async () => {
    const { app } = await makeApp();
    await db.applicationFile.updateMany({
      where: { applicationId: app.id },
      data: { filename: 'evil"\r\nX-Injected: 1/../a;b.pdf' },
    });
    const res = await get(app.id, "HR_MANAGER");
    expect(res.status).toBe(200);
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(res.headers.get("x-injected")).toBeNull();
    expect(disposition.startsWith("attachment;")).toBe(true);
    await res.arrayBuffer();
  });

  it("serves nothing when the audit row cannot be written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = await makeApp();
    state.failAudit = true;
    const res = await get(app.id, "HR_MANAGER");
    expect(res.status).toBe(503);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.includes(PDF)).toBe(false);
    expect(res.headers.get("content-disposition")).toBeNull();
    state.failAudit = false;
    expect(await db.auditLog.count()).toBe(0);
  });

  it("refuses a cross-site request after the auth check; same-origin, none and header-less work", async () => {
    const { app } = await makeApp();
    expect((await get(app.id, null, { "sec-fetch-site": "cross-site" })).status).toBe(401);
    const cross = await get(app.id, "HR_MANAGER", { "sec-fetch-site": "cross-site" });
    expect(cross.status).toBe(403);
    expect(await cross.text()).toBe("");
    expect(await db.auditLog.count()).toBe(0);

    for (const site of ["same-origin", "none", undefined]) {
      const res = await get(app.id, "HR_MANAGER", site ? { "sec-fetch-site": site } : {});
      expect(res.status, String(site)).toBe(200);
      await res.arrayBuffer();
    }
    expect(await auditFor("application.cv-download")).toHaveLength(3);
  });

  it("HEAD answers 405 Allow: GET for allowed roles with no audit row", async () => {
    const { app, key } = await makeApp();
    for (const role of ALLOWED) {
      const res = await head(app.id, role);
      expect(res.status, role).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
      expect(await res.text()).toBe("");
      await expectNoKey(res, key);
    }
    expect(await db.auditLog.count()).toBe(0);
  });

  it("HEAD keeps the auth answers: 401 signed out, 403 for a denied role", async () => {
    const { app } = await makeApp();
    expect((await head(app.id, null)).status).toBe(401);
    for (const role of DENIED) expect((await head(app.id, role)).status, role).toBe(403);
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("careers recipients setting", () => {
  const TOKEN = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";

  it.each(["SUPER_ADMIN", "ADMINISTRATOR"] as const)("%s can save Careers recipients and the submit uses them", async (role) => {
    signedInAs(role);
    const fd = new FormData();
    fd.set("type", "CAREERS");
    fd.set("recipients", "Hiring@Test.Example, hr2@test.example");
    expect(await saveRecipients(null, fd)).toMatchObject({ ok: true, type: "CAREERS" });

    state.headers = new Headers({ "x-forwarded-for": `198.51.100.${role === "SUPER_ADMIN" ? 41 : 42}`, "user-agent": UA });
    const apply = new FormData();
    for (const [k, v] of Object.entries({
      fullName: NAME,
      email: EMAIL,
      consent: "on",
      website: "",
      submissionId: TOKEN,
    })) {
      apply.set(k, v);
    }
    apply.append(
      "cv",
      new File([new TextEncoder().encode("%PDF-1.4\n% TEST fixture\n%%EOF\n")], "TEST-cv.pdf", { type: "application/pdf" }),
    );
    const result = await submitApplication(apply);
    expect(result.ok).toBe(true);
    const internal = state.sent.find((m) => m.to.includes("hiring@test.example"));
    expect(internal?.to).toEqual(["hiring@test.example", "hr2@test.example"]);
    expect(internal?.text).toContain(NAME);
    // The candidate-facing acknowledgement still goes only to the candidate.
    expect(state.sent.some((m) => m.to.length === 1 && m.to[0] === EMAIL)).toBe(true);
    await rm(state.root, { recursive: true, force: true });
  });

  it.each(["HR_MANAGER", "SALES_MANAGER", "CONTENT_EDITOR"] as const)("%s is refused saving recipients with a 403", async (role) => {
    signedInAs(role);
    const fd = new FormData();
    fd.set("type", "CAREERS");
    fd.set("recipients", "a@test.example");
    expect(await rejection(() => saveRecipients(null, fd))).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await db.siteSetting.count()).toBe(0);
  });
});
