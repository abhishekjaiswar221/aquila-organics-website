import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

// Real users, real Better Auth sessions and the real requireAction(): the only
// fakes are the request headers and next/cache's refresh() (it needs a Server
// Action request scope). redirect()/forbidden() run unmocked.
const state = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => state.headers,
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  refresh: vi.fn(),
}));

const { createCredentialUser } = await import("@/lib/admin-seed");
const { auth } = await import("@/lib/auth");
const { createJob, updateJob, setJobStatus, deleteJob } = await import("@/features/careers/job-actions");
const { listAdminJobs, getJobForEdit, listPublishedJobs, getPublishedJobBySlug } = await import("@/features/careers/job-queries");
const { STALE_JOB_ERROR } = await import("@/features/careers/job-schema");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"];
const ALLOWED: Role[] = ["SUPER_ADMIN", "HR_MANAGER"];
const DENIED: Role[] = ["ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"];
const cookies = new Map<Role, string>();
const asRole = (r: Role | null) => {
  state.headers = r ? new Headers({ cookie: cookies.get(r) ?? "" }) : new Headers();
};
const digestOf = (e: unknown) => (e instanceof Error && "digest" in e ? String(e.digest) : String(e));
const thrown = (run: () => Promise<unknown>) => run().then(() => "resolved", digestOf);

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const JOB = {
  title: "Quality Analyst",
  location: "Mumbai",
  employmentType: "FULL_TIME",
  summary: "Runs incoming material checks.",
  description: "First paragraph.\r\n\r\nSecond paragraph.",
};

/** createJob redirects to the edit page on success; returns the new id. */
async function create(overrides: Record<string, string> = {}): Promise<string> {
  const digest = await thrown(() => createJob(null, fd({ ...JOB, ...overrides })));
  const match = /^NEXT_REDIRECT;[a-z]+;\/admin\/jobs\/([0-9a-f-]{36})\/edit;/.exec(digest);
  if (!match) throw new Error(`createJob did not redirect: ${digest}`);
  return match[1];
}

const makeRow = (slug: string, data: Record<string, unknown> = {}) =>
  db.jobOpening.create({
    data: {
      slug,
      title: `TEST ${slug}`,
      location: "Mumbai",
      employmentType: "FULL_TIME",
      summary: "s",
      description: "d",
      ...data,
    },
  });

const NOW = new Date("2026-06-15T12:00:00Z");

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  await resetDb();
  for (const role of ROLES) {
    const email = `job-${role.toLowerCase().replace(/_/g, "-")}@example.test`;
    await createCredentialUser({ email, password: `job-${role}-password`, role });
    const { headers } = await auth.api.signInEmail({ body: { email, password: `job-${role}-password` }, returnHeaders: true });
    cookies.set(role, headers.getSetCookie().map((c) => c.split(";")[0]).join("; "));
  }
});

beforeEach(async () => {
  await db.jobApplication.deleteMany();
  await db.jobOpening.deleteMany();
  await db.auditLog.deleteMany();
  asRole("HR_MANAGER");
});

describe("createJob", () => {
  it("always creates a DRAFT, ignoring a posted status and publishedAt", async () => {
    const id = await create({ status: "PUBLISHED", publishedAt: "2026-01-01" });
    const row = await db.jobOpening.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "DRAFT", publishedAt: null, slug: "quality-analyst", title: "Quality Analyst" });
    expect(row.description).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("stores closesOn as a calendar date", async () => {
    const id = await create({ closesOn: "2026-12-31" });
    const edit = await getJobForEdit(id);
    expect(edit?.closesOn).toBe("2026-12-31");
  });

  it("reports a duplicate slug as a field error and creates nothing more", async () => {
    await create();
    const result = await createJob(null, fd({ ...JOB }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { slug: "That URL slug is already used by another opening." } });
    expect(await db.jobOpening.count()).toBe(1);
  });

  it("returns per-field errors for invalid input and writes nothing", async () => {
    const result = await createJob(null, fd({ ...JOB, title: "", closesOn: "2026-02-31", employmentType: "X", slug: "apply" }));
    expect(result).toMatchObject({ ok: false });
    expect(Object.keys(result?.fieldErrors ?? {}).sort()).toEqual(["closesOn", "employmentType", "slug", "title"]);
    expect(await db.jobOpening.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("updateJob", () => {
  it("saves changes and audits only the changed field names", async () => {
    const id = await create();
    const edit = await getJobForEdit(id);
    const result = await updateJob(null, fd({ ...JOB, id, updatedAt: edit!.updatedAt, location: "Secret Pune Office" }));
    expect(result).toEqual({ ok: true, message: "Saved." });
    expect((await db.jobOpening.findUniqueOrThrow({ where: { id } })).location).toBe("Secret Pune Office");
    const row = await db.auditLog.findFirstOrThrow({ where: { action: "job.update" } });
    expect(row.changedFields).toEqual(["location"]);
    expect(row.entityId).toBe(id);
  });

  it("rejects a stale updatedAt and writes nothing", async () => {
    const id = await create();
    const edit = await getJobForEdit(id);
    await updateJob(null, fd({ ...JOB, id, updatedAt: edit!.updatedAt, location: "First save" }));
    const result = await updateJob(null, fd({ ...JOB, id, updatedAt: edit!.updatedAt, location: "Second save" }));
    expect(result).toEqual({ ok: false, message: STALE_JOB_ERROR });
    expect(STALE_JOB_ERROR).toBe("This opening was changed by someone else. Reload and try again.");
    expect((await db.jobOpening.findUniqueOrThrow({ where: { id } })).location).toBe("First save");
    expect(await db.auditLog.count({ where: { action: "job.update" } })).toBe(1);
  });

  it("rejects a missing or malformed updatedAt", async () => {
    const id = await create();
    expect(await updateJob(null, fd({ ...JOB, id }))).toEqual({ ok: false, message: STALE_JOB_ERROR });
    expect(await updateJob(null, fd({ ...JOB, id, updatedAt: "nonsense" }))).toEqual({ ok: false, message: STALE_JOB_ERROR });
  });

  it("rejects moving to another opening's slug", async () => {
    await makeRow("taken");
    const id = await create();
    const edit = await getJobForEdit(id);
    const result = await updateJob(null, fd({ ...JOB, id, updatedAt: edit!.updatedAt, slug: "taken" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
  });

  it("is a no-op (no audit row) when nothing changed, and 404-style for an unknown id", async () => {
    const id = await create();
    const edit = await getJobForEdit(id);
    expect(await updateJob(null, fd({ ...JOB, id, updatedAt: edit!.updatedAt }))).toEqual({ ok: true, message: "No changes to save." });
    expect(await db.auditLog.count({ where: { action: "job.update" } })).toBe(0);
    const missing = await updateJob(null, fd({ ...JOB, id: "00000000-0000-4000-8000-000000000000", updatedAt: edit!.updatedAt }));
    expect(missing).toEqual({ ok: false, message: "Opening not found." });
  });
});

describe("setJobStatus and the public queries", () => {
  it("publishing sets publishedAt and lists the opening publicly", async () => {
    const id = await create();
    expect(await listPublishedJobs(new Date())).toHaveLength(0);
    expect(await setJobStatus(null, fd({ id, status: "PUBLISHED" }))).toEqual({ ok: true, message: "Opening published." });
    const row = await db.jobOpening.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("PUBLISHED");
    expect(row.publishedAt).toBeInstanceOf(Date);
    const list = await listPublishedJobs(new Date());
    expect(list.map((j) => j.slug)).toEqual(["quality-analyst"]);
    expect(list[0]).not.toHaveProperty("status");
    expect((await getPublishedJobBySlug("quality-analyst", new Date()))?.id).toBe(id);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "job.status" } });
    expect(audit.detail).toEqual({ from: "DRAFT", to: "PUBLISHED" });
  });

  it("blocks publishing when a required field is empty", async () => {
    const row = await makeRow("incomplete", { summary: "" });
    const result = await setJobStatus(null, fd({ id: row.id, status: "PUBLISHED" }));
    expect(result).toMatchObject({ ok: false });
    expect(result?.message).toContain("before publishing");
    const after = await db.jobOpening.findUniqueOrThrow({ where: { id: row.id } });
    expect(after).toMatchObject({ status: "DRAFT", publishedAt: null });
    expect(await db.auditLog.count()).toBe(0);
  });

  it("closing removes it from the public list and detail", async () => {
    const id = await create();
    await setJobStatus(null, fd({ id, status: "PUBLISHED" }));
    expect(await setJobStatus(null, fd({ id, status: "CLOSED" }))).toEqual({ ok: true, message: "Opening closed." });
    expect(await listPublishedJobs(new Date())).toHaveLength(0);
    expect(await getPublishedJobBySlug("quality-analyst", new Date())).toBeNull();
    expect(await setJobStatus(null, fd({ id, status: "DRAFT" }))).toMatchObject({ ok: true });
    expect(await listPublishedJobs(new Date())).toHaveLength(0);
  });

  it("a draft is never public", async () => {
    await makeRow("draft-one");
    expect(await listPublishedJobs(NOW)).toHaveLength(0);
    expect(await getPublishedJobBySlug("draft-one", NOW)).toBeNull();
  });

  it("excludes an opening whose closesOn is before today (UTC) and keeps today and later", async () => {
    await makeRow("past", { status: "PUBLISHED", publishedAt: NOW, closesOn: new Date("2026-06-14T00:00:00Z") });
    await makeRow("today", { status: "PUBLISHED", publishedAt: NOW, closesOn: new Date("2026-06-15T00:00:00Z") });
    await makeRow("future", { status: "PUBLISHED", publishedAt: NOW, closesOn: new Date("2026-06-16T00:00:00Z") });
    await makeRow("open-ended", { status: "PUBLISHED", publishedAt: NOW });
    expect((await listPublishedJobs(NOW)).map((j) => j.slug).sort()).toEqual(["future", "open-ended", "today"]);
    expect(await getPublishedJobBySlug("past", NOW)).toBeNull();
    expect((await getPublishedJobBySlug("today", NOW))?.slug).toBe("today");
    // The same row is public on an earlier day.
    expect((await getPublishedJobBySlug("past", new Date("2026-06-14T23:59:59Z")))?.slug).toBe("past");
  });

  it("rejects an invalid status or id and reports an unchanged status", async () => {
    const id = await create();
    expect(await setJobStatus(null, fd({ id, status: "ARCHIVED" }))).toEqual({ ok: false, message: "That status is not valid." });
    expect(await setJobStatus(null, fd({ id: "nope", status: "PUBLISHED" }))).toEqual({ ok: false, message: "Opening not found." });
    expect(await setJobStatus(null, fd({ id, status: "DRAFT" }))).toMatchObject({ ok: true });
    expect(await db.auditLog.count({ where: { action: "job.status" } })).toBe(0);
  });

  it("filters the admin list by status", async () => {
    await makeRow("a");
    await makeRow("b", { status: "PUBLISHED", publishedAt: NOW });
    expect((await listAdminJobs({})).total).toBe(2);
    const published = await listAdminJobs({ status: "PUBLISHED" });
    expect(published.items.map((j) => j.slug)).toEqual(["b"]);
  });
});

describe("deleteJob", () => {
  it("refuses a PUBLISHED or CLOSED opening and changes nothing", async () => {
    const pub = await makeRow("pub", { status: "PUBLISHED", publishedAt: NOW });
    const closed = await makeRow("closed", { status: "CLOSED" });
    for (const row of [pub, closed]) {
      const result = await deleteJob(null, fd({ id: row.id }));
      expect(result).toEqual({ ok: false, message: "Only a draft opening can be deleted. Close it instead." });
    }
    expect(await db.jobOpening.count()).toBe(2);
    expect(await db.auditLog.count({ where: { action: "job.delete" } })).toBe(0);
  });

  it("refuses a DRAFT that has an application", async () => {
    const row = await makeRow("with-app");
    await db.jobApplication.create({
      data: {
        reference: "CA-2026-000001",
        jobId: row.id,
        jobTitleSnapshot: row.title,
        fullName: "TEST candidate",
        email: "candidate@example.test",
        consentAt: new Date(),
      },
    });
    const result = await deleteJob(null, fd({ id: row.id }));
    expect(result).toEqual({ ok: false, message: "This opening has applications and cannot be deleted. Close it instead." });
    expect(await db.jobOpening.count()).toBe(1);
    expect(await db.jobApplication.count({ where: { jobId: row.id } })).toBe(1);
  });

  it("deletes an empty DRAFT and audits it", async () => {
    const id = await create();
    expect(await deleteJob(null, fd({ id }))).toEqual({ ok: true, message: "Opening deleted." });
    expect(await db.jobOpening.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "job.delete", entityId: id } })).toBe(1);
  });

  it("reports an unknown opening", async () => {
    expect(await deleteJob(null, fd({ id: "00000000-0000-4000-8000-000000000000" }))).toEqual({ ok: false, message: "Opening not found." });
  });
});

describe("audit trail", () => {
  it("records ids, enums and field names only, never what was typed", async () => {
    const id = await create({ title: "Zebra Wrangler", location: "Atlantis HQ", summary: "Wrangles zebras", description: "Secret duties" });
    const edit = await getJobForEdit(id);
    await updateJob(null, fd({ ...JOB, title: "Zebra Wrangler", location: "Atlantis HQ", summary: "Wrangles zebras", description: "Secret duties changed", id, updatedAt: edit!.updatedAt }));
    await setJobStatus(null, fd({ id, status: "PUBLISHED" }));
    await setJobStatus(null, fd({ id, status: "DRAFT" }));
    await deleteJob(null, fd({ id }));
    const rows = await db.auditLog.findMany({ orderBy: { at: "asc" } });
    expect(rows.map((r) => r.action)).toEqual(["job.create", "job.update", "job.status", "job.status", "job.delete"]);
    const dump = JSON.stringify(rows);
    for (const secret of ["Zebra", "Atlantis", "Wrangle", "Secret", "zebra-wrangler"]) expect(dump).not.toContain(secret);
    for (const row of rows) {
      expect(row).toMatchObject({ entityType: "job", entityId: id, outcome: "ok" });
    }
  });
});

describe("access control", () => {
  it.each(ALLOWED)("allows %s on every action", async (role) => {
    asRole(role);
    const id = await create({ slug: `by-${role.toLowerCase()}`.replace(/_/g, "-") });
    const edit = await getJobForEdit(id);
    expect(await updateJob(null, fd({ ...JOB, slug: `by-${role.toLowerCase()}`.replace(/_/g, "-"), id, updatedAt: edit!.updatedAt, location: "Elsewhere" }))).toMatchObject({ ok: true });
    expect(await setJobStatus(null, fd({ id, status: "PUBLISHED" }))).toMatchObject({ ok: true });
    await setJobStatus(null, fd({ id, status: "DRAFT" }));
    expect(await deleteJob(null, fd({ id }))).toMatchObject({ ok: true });
  });

  it.each(DENIED)("refuses %s with a 403 on every action and writes nothing", async (role) => {
    const open = await makeRow("existing");
    const before = await db.jobOpening.findUniqueOrThrow({ where: { id: open.id } });
    asRole(role);
    const calls = [
      () => createJob(null, fd(JOB)),
      () => updateJob(null, fd({ ...JOB, id: open.id, updatedAt: before.updatedAt.toISOString(), location: "Hacked" })),
      () => setJobStatus(null, fd({ id: open.id, status: "PUBLISHED" })),
      () => deleteJob(null, fd({ id: open.id })),
    ];
    for (const call of calls) expect(await thrown(call)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await db.jobOpening.count()).toBe(1);
    expect(await db.jobOpening.findUniqueOrThrow({ where: { id: open.id } })).toEqual(before);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("redirects a signed-out caller to login on every action and writes nothing", async () => {
    const open = await makeRow("existing");
    asRole(null);
    const calls = [
      () => createJob(null, fd(JOB)),
      () => updateJob(null, fd({ ...JOB, id: open.id, updatedAt: new Date().toISOString() })),
      () => setJobStatus(null, fd({ id: open.id, status: "PUBLISHED" })),
      () => deleteJob(null, fd({ id: open.id })),
    ];
    for (const call of calls) expect(await thrown(call)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);
    expect(await db.jobOpening.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(0);
  });
});
