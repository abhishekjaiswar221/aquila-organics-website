import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

// Real users, real Better Auth sessions and the real requireAction(): the only
// fakes are the request headers, next/cache's refresh() (it needs a Server
// Action request scope) and a switch that makes recordAudit fail on demand.
const state = vi.hoisted(() => ({ headers: new Headers(), failAudit: false }));

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

const { auth } = await import("@/lib/auth");
const { createCredentialUser } = await import("@/lib/admin-seed");
const { createProduct, updateProduct } = await import("@/features/products/edit-actions");
const { STALE_PRODUCT_ERROR } = await import("@/features/products/form-schema");
const { getProductForEdit } = await import("@/features/products/edit-queries");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "SALES_EXECUTIVE" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "SALES_EXECUTIVE", "CONTENT_EDITOR", "HR_MANAGER"];
const CAN_EDIT: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"];
const CANNOT_EDIT: Role[] = ["HR_MANAGER", "SALES_EXECUTIVE"];

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

async function thrown(run: () => Promise<unknown>): Promise<string> {
  return run().then(
    () => "resolved",
    (e: unknown) => digestOf(e),
  );
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function makeProduct(
  slug: string,
  data: { status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; verified?: boolean; description?: string } = {},
) {
  const published = data.status === "PUBLISHED";
  return db.product.create({
    data: {
      name: `TEST-${slug}`,
      slug,
      code: `TEST-${slug.toUpperCase()}`,
      description: data.description ?? "TEST description",
      sourceNote: "TEST-legacy, unverified",
      status: data.status ?? "DRAFT",
      verified: data.verified ?? published,
      publishedAt: published ? new Date("2026-01-01T00:00:00Z") : null,
    },
  });
}

/** The form a browser would post for the product as it is stored right now. */
async function editForm(id: string, overrides: Record<string, string> = {}): Promise<FormData> {
  const model = await getProductForEdit(id);
  if (!model) throw new Error("missing product");
  const entries: Record<string, string> = {
    id,
    updatedAt: model.updatedAt,
    name: model.name,
    slug: model.slug,
    code: model.code ?? "",
    casNumber: model.casNumber ?? "",
    categoryId: model.categoryId ?? "",
    description: model.description ?? "",
    seoTitle: model.seoTitle ?? "",
    seoDescription: model.seoDescription ?? "",
    sourceNote: model.sourceNote ?? "",
  };
  model.specifications.forEach((s, i) => {
    entries[`spec-label-${i}`] = s.label;
    entries[`spec-value-${i}`] = s.value;
  });
  model.applications.forEach((a, i) => {
    entries[`application-${i}`] = a;
  });
  return form({ ...entries, ...overrides });
}

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
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

beforeEach(async () => {
  await db.auditLog.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  state.failAudit = false;
  signedInAs("CONTENT_EDITOR");
});

afterEach(() => {
  state.failAudit = false;
});

describe("createProduct", () => {
  it("always stores DRAFT and unverified, ignoring posted status and verified, and redirects to the edit page", async () => {
    const digest = await thrown(() =>
      createProduct(null, form({ name: "TEST Ethanol", casNumber: "64-17-5", status: "PUBLISHED", verified: "true", casNormalized: "000", publishedAt: "2020-01-01" })),
    );
    const row = await db.product.findFirstOrThrow({ where: { name: "TEST Ethanol" } });
    expect(digest).toBe(`NEXT_REDIRECT;replace;/admin/products/${row.id}/edit;307;`);
    expect(row.status).toBe("DRAFT");
    expect(row.verified).toBe(false);
    expect(row.publishedAt).toBeNull();
    expect(row.slug).toBe("test-ethanol");
    expect(row.casNormalized).toBe("64175");
  });

  it("stores specifications and applications in order and audits product.create with changedFields", async () => {
    await thrown(() =>
      createProduct(
        null,
        form({
          name: "TEST Ordered",
          "spec-label-0": "Purity",
          "spec-value-0": "99%",
          "spec-label-1": "Colour",
          "spec-value-1": "Clear",
          "application-0": "Soap",
          "application-1": "Candles",
        }),
      ),
    );
    const row = await db.product.findFirstOrThrow({ where: { name: "TEST Ordered" } });
    const model = await getProductForEdit(row.id);
    expect(model?.specifications).toEqual([
      { label: "Purity", value: "99%" },
      { label: "Colour", value: "Clear" },
    ]);
    expect(model?.applications).toEqual(["Soap", "Candles"]);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "product.create" } });
    expect(audit).toMatchObject({ entityId: row.id, actorRole: "CONTENT_EDITOR", outcome: "ok", actorId: userIds.get("CONTENT_EDITOR") });
    expect(audit.changedFields).toEqual(expect.arrayContaining(["name", "slug", "specifications", "applications"]));
  });

  it("returns a field error for a duplicate slug and writes no row", async () => {
    await makeProduct("taken-slug");
    const before = await db.product.count();
    const result = await createProduct(null, form({ name: "Other", slug: "taken-slug" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { slug: expect.stringMatching(/already used/) } });
    expect(await db.product.count()).toBe(before);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("returns a field error for a duplicate code and writes no row", async () => {
    await makeProduct("coded");
    const before = await db.product.count();
    const result = await createProduct(null, form({ name: "Other", code: "TEST-CODED" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { code: expect.stringMatching(/already used/) } });
    expect(await db.product.count()).toBe(before);
  });

  it("returns field errors for invalid input and writes nothing", async () => {
    const result = await createProduct(null, form({ name: "", casNumber: "64-17-4" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String), casNumber: expect.any(String) } });
    expect(await db.product.count()).toBe(0);
  });

  it("rejects a category that does not exist", async () => {
    const result = await createProduct(null, form({ name: "X", categoryId: "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { categoryId: expect.any(String) } });
    expect(await db.product.count()).toBe(0);
  });

  it("leaves no product behind when the audit insert fails", async () => {
    state.failAudit = true;
    const result = await createProduct(null, form({ name: "TEST Rollback" }));
    expect(result).toMatchObject({ ok: false });
    expect(await db.product.count()).toBe(0);
  });
});

describe("updateProduct", () => {
  it("edits a DRAFT freely and audits product.update with only the changed fields", async () => {
    const p = await makeProduct("draft-one");
    const result = await updateProduct(null, await editForm(p.id, { description: "Changed", seoTitle: "SEO" }));
    expect(result).toMatchObject({ ok: true });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ description: "Changed", seoTitle: "SEO", status: "DRAFT", verified: false });
    const audits = await db.auditLog.findMany({ where: { entityId: p.id } });
    expect(audits.map((a) => a.action)).toEqual(["product.update"]);
    expect([...audits[0].changedFields].sort()).toEqual(["description", "seoTitle"]);
  });

  it("writes nothing when nothing changed", async () => {
    const p = await makeProduct("same");
    const result = await updateProduct(null, await editForm(p.id));
    expect(result).toMatchObject({ ok: true });
    expect(await db.auditLog.count()).toBe(0);
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.updatedAt.getTime()).toBe(p.updatedAt.getTime());
  });

  it("edits ARCHIVED products freely", async () => {
    const p = await makeProduct("archived-one", { status: "ARCHIVED", verified: true });
    await updateProduct(null, await editForm(p.id, { description: "Changed" }));
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ description: "Changed", status: "ARCHIVED", verified: true });
    expect(await db.auditLog.count({ where: { action: "product.reverify" } })).toBe(0);
  });

  it("unpublishes a PUBLISHED product whose description changes and records product.reverify", async () => {
    const p = await makeProduct("pub-desc", { status: "PUBLISHED", verified: true });
    const result = await updateProduct(null, await editForm(p.id, { description: "New public text" }));
    expect(result).toMatchObject({ ok: true });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ status: "DRAFT", verified: false, publishedAt: null, description: "New public text" });
    const actions = (await db.auditLog.findMany({ where: { entityId: p.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(["product.reverify", "product.update"]);
  });

  it("re-verifies for a specifications change and for an applications change", async () => {
    const a = await makeProduct("pub-spec", { status: "PUBLISHED" });
    await updateProduct(null, await editForm(a.id, { "spec-label-0": "Purity", "spec-value-0": "99%" }));
    expect(await db.product.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "DRAFT", verified: false });
    const b = await makeProduct("pub-app", { status: "PUBLISHED" });
    await updateProduct(null, await editForm(b.id, { "application-0": "Soap" }));
    expect(await db.product.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "DRAFT", verified: false });
  });

  it("keeps a PUBLISHED product published and verified when only the source note changes", async () => {
    const p = await makeProduct("pub-note", { status: "PUBLISHED", verified: true });
    const result = await updateProduct(null, await editForm(p.id, { sourceNote: "Checked against the SDS" }));
    expect(result).toMatchObject({ ok: true });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ status: "PUBLISHED", verified: true, sourceNote: "Checked against the SDS" });
    expect(row.publishedAt).not.toBeNull();
    const audits = await db.auditLog.findMany({ where: { entityId: p.id } });
    expect(audits.map((a) => a.action)).toEqual(["product.update"]);
    expect(audits[0].changedFields).toEqual(["sourceNote"]);
  });

  it("rolls the whole change back when the audit insert fails (still PUBLISHED, children untouched)", async () => {
    const p = await makeProduct("pub-atomic", { status: "PUBLISHED", verified: true });
    await db.productSpecification.create({ data: { productId: p.id, label: "Old", value: "Row", sortOrder: 0 } });
    const form1 = await editForm(p.id, { description: "Should not persist", "spec-label-0": "New", "spec-value-0": "Row" });
    state.failAudit = true;
    const result = await updateProduct(null, form1);
    expect(result).toMatchObject({ ok: false });
    const row = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ status: "PUBLISHED", verified: true, description: "TEST description" });
    expect(row.publishedAt).not.toBeNull();
    expect(row.updatedAt.getTime()).toBe(p.updatedAt.getTime());
    expect((await getProductForEdit(p.id))?.specifications).toEqual([{ label: "Old", value: "Row" }]);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("rejects a stale updatedAt with the exact message and writes nothing", async () => {
    const p = await makeProduct("stale");
    const mine = await editForm(p.id, { description: "Mine" });
    // Someone else saves first.
    await updateProduct(null, await editForm(p.id, { description: "Theirs" }));
    const auditCount = await db.auditLog.count();
    const result = await updateProduct(null, mine);
    expect(result).toEqual({ ok: false, message: "This product was changed by someone else. Reload and try again." });
    expect(STALE_PRODUCT_ERROR).toBe("This product was changed by someone else. Reload and try again.");
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).description).toBe("Theirs");
    expect(await db.auditLog.count()).toBe(auditCount);
  });

  it("rejects a missing or malformed updatedAt as stale", async () => {
    const p = await makeProduct("no-stamp");
    const result = await updateProduct(null, await editForm(p.id, { updatedAt: "nonsense", description: "X" }));
    expect(result).toEqual({ ok: false, message: STALE_PRODUCT_ERROR });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).description).toBe("TEST description");
  });

  it("replaces specifications and applications in order", async () => {
    const p = await makeProduct("children");
    await db.productSpecification.createMany({
      data: [
        { productId: p.id, label: "A", value: "1", sortOrder: 0 },
        { productId: p.id, label: "B", value: "2", sortOrder: 1 },
      ],
    });
    await db.productApplication.create({ data: { productId: p.id, name: "Old", sortOrder: 0 } });
    const result = await updateProduct(
      null,
      await editForm(p.id, {
        "spec-label-0": "Z",
        "spec-value-0": "9",
        "spec-label-1": "Y",
        "spec-value-1": "8",
        "spec-label-2": "X",
        "spec-value-2": "7",
        "application-0": "Third",
        "application-1": "First",
        "application-2": "Second",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    const model = await getProductForEdit(p.id);
    expect(model?.specifications.map((s) => s.label)).toEqual(["Z", "Y", "X"]);
    expect(model?.applications).toEqual(["Third", "First", "Second"]);
    expect(await db.productSpecification.count({ where: { productId: p.id } })).toBe(3);
    expect(await db.productApplication.count({ where: { productId: p.id } })).toBe(3);
  });

  it("returns a field error for a slug another product uses, changing nothing", async () => {
    await makeProduct("first");
    const p = await makeProduct("second");
    const result = await updateProduct(null, await editForm(p.id, { slug: "first" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).slug).toBe("second");
  });

  it("ignores posted status, verified and publishedAt", async () => {
    const p = await makeProduct("no-status", { status: "DRAFT" });
    await updateProduct(null, await editForm(p.id, { description: "Changed", status: "PUBLISHED", verified: "true" }));
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: "DRAFT", verified: false, publishedAt: null });
  });

  it("answers not found for an unknown or malformed id", async () => {
    const p = await makeProduct("exists");
    const good = await editForm(p.id, { description: "X" });
    expect(await updateProduct(null, await editForm(p.id, { id: "nope", description: "X" }))).toMatchObject({ ok: false, message: "Product not found." });
    await db.product.delete({ where: { id: p.id } });
    expect(await updateProduct(null, good)).toMatchObject({ ok: false, message: "Product not found." });
  });
});

describe("authorisation", () => {
  it.each(CAN_EDIT)("%s can create and edit", async (role) => {
    signedInAs(role);
    const slug = `by-${role.toLowerCase().replace(/_/g, "-")}`;
    await thrown(() => createProduct(null, form({ name: `TEST ${slug}`, slug })));
    const row = await db.product.findUniqueOrThrow({ where: { slug } });
    expect(await updateProduct(null, await editForm(row.id, { description: "Edited" }))).toMatchObject({ ok: true });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "product.update", entityId: row.id } })).actorRole).toBe(role);
  });

  it.each(CANNOT_EDIT)("%s is refused with a 403 and nothing is written", async (role) => {
    const p = await makeProduct("guarded");
    const edit = await editForm(p.id, { description: "Nope" });
    signedInAs(role);
    expect(await thrown(() => createProduct(null, form({ name: "Nope" })))).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await thrown(() => updateProduct(null, edit))).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await db.product.count()).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).description).toBe("TEST description");
  });

  it("sends a signed-out request to the login page", async () => {
    signedInAs(null);
    expect(await thrown(() => createProduct(null, form({ name: "Nope" })))).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;307;/);
  });
});
