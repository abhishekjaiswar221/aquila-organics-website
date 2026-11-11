import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

const state = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { createCredentialUser } = await import("@/lib/admin-seed");
const { auth } = await import("@/lib/auth");
const { manageCategory } = await import("@/features/categories/actions");
const { listCategories } = await import("@/features/categories/queries");
const { listAdminProducts } = await import("@/features/products/admin-queries");
const { IMPORT_NOTE_PREFIX, isImportedNote } = await import("@/features/products/import-marker");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"];
const cookies = new Map<Role, string>();
const asRole = (r: Role) => {
  state.headers = new Headers({ cookie: cookies.get(r) ?? "" });
};
const digestOf = (e: unknown) => (e instanceof Error && "digest" in e ? String(e.digest) : String(e));

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const names = async () => (await listCategories()).map((c) => c.name);

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  await resetDb();
  for (const role of ROLES) {
    const email = `cat-${role.toLowerCase()}@example.test`;
    await createCredentialUser({ email, password: `cat-${role}-password`, role });
    const { headers } = await auth.api.signInEmail({ body: { email, password: `cat-${role}-password` }, returnHeaders: true });
    cookies.set(role, headers.getSetCookie().map((c) => c.split(";")[0]).join("; "));
  }
});

beforeEach(async () => {
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.auditLog.deleteMany();
  asRole("CONTENT_EDITOR");
});

describe("manageCategory", () => {
  it("creates categories at the end, in order, and audits without the name", async () => {
    expect(await manageCategory(null, fd({ intent: "create", name: "  Ethers " }))).toMatchObject({ ok: true });
    await manageCategory(null, fd({ intent: "create", name: "Esters" }));
    expect(await names()).toEqual(["Ethers", "Esters"]);
    const rows = await db.auditLog.findMany({ where: { action: "category.create" } });
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain("Ethers");
  });

  it("rejects a duplicate name or slug and a blank name", async () => {
    await manageCategory(null, fd({ intent: "create", name: "Ethers" }));
    expect(await manageCategory(null, fd({ intent: "create", name: "ethers" }))).toEqual({
      ok: false,
      message: "A category with this name already exists.",
    });
    expect(await manageCategory(null, fd({ intent: "create", name: "  " }))).toMatchObject({ ok: false });
    expect(await db.category.count()).toBe(1);
  });

  it("renames without changing the slug", async () => {
    await manageCategory(null, fd({ intent: "create", name: "Ethers" }));
    const [c] = await listCategories();
    expect(await manageCategory(null, fd({ intent: "rename", id: c.id, name: "Ethers & Co" }))).toMatchObject({ ok: true });
    const after = await db.category.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({ name: "Ethers & Co", slug: "ethers" });
    const missing = await manageCategory(null, fd({ intent: "rename", id: "00000000-0000-4000-8000-000000000000", name: "X" }));
    expect(missing).toMatchObject({ ok: false });
  });

  it("moves up and down and ignores moves past either end", async () => {
    for (const n of ["A", "B", "C"]) await manageCategory(null, fd({ intent: "create", name: n }));
    const [a, b, c] = await listCategories();
    await manageCategory(null, fd({ intent: "move", id: c.id, direction: "up" }));
    expect(await names()).toEqual(["A", "C", "B"]);
    await manageCategory(null, fd({ intent: "move", id: a.id, direction: "up" }));
    expect(await names()).toEqual(["A", "C", "B"]);
    await manageCategory(null, fd({ intent: "move", id: b.id, direction: "down" }));
    expect(await names()).toEqual(["A", "C", "B"]);
    expect(await manageCategory(null, fd({ intent: "move", id: a.id, direction: "sideways" }))).toMatchObject({ ok: false });
  });

  it("refuses to delete a category a product uses and changes nothing", async () => {
    await manageCategory(null, fd({ intent: "create", name: "Ethers" }));
    const [c] = await listCategories();
    await db.product.create({ data: { name: "TEST-p", slug: "test-p", categoryId: c.id } });
    const result = await manageCategory(null, fd({ intent: "delete", id: c.id }));
    expect(result).toEqual({ ok: false, message: "1 product uses this category. Move them first." });
    expect(await db.category.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "category.delete" } })).toBe(0);
  });

  it("deletes an unused category and audits it", async () => {
    await manageCategory(null, fd({ intent: "create", name: "Ethers" }));
    const [c] = await listCategories();
    expect(await manageCategory(null, fd({ intent: "delete", id: c.id }))).toMatchObject({ ok: true });
    expect(await db.category.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "category.delete", entityId: c.id } })).toBe(1);
  });

  it("rejects an unknown intent", async () => {
    expect(await manageCategory(null, fd({ intent: "drop" }))).toMatchObject({ ok: false });
  });

  it.each(["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"] as const)("allows %s", async (role) => {
    asRole(role);
    expect(await manageCategory(null, fd({ intent: "create", name: `By ${role}` }))).toMatchObject({ ok: true });
  });

  it("refuses HR_MANAGER with a 403 and signed-out with a login redirect", async () => {
    asRole("HR_MANAGER");
    const e1 = await manageCategory(null, fd({ intent: "create", name: "X" })).catch((e: unknown) => e);
    expect(digestOf(e1)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    state.headers = new Headers();
    const e2 = await manageCategory(null, fd({ intent: "create", name: "X" })).catch((e: unknown) => e);
    expect(digestOf(e2)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);
    expect(await db.category.count()).toBe(0);
  });
});

describe("import review filter", () => {
  it("returns only DRAFT products with the import note", async () => {
    const mk = (slug: string, data: Record<string, unknown>) => db.product.create({ data: { name: `TEST-${slug}`, slug, ...data } });
    await mk("imp-draft", { sourceNote: `${IMPORT_NOTE_PREFIX}; verify.` });
    await mk("imp-archived", { sourceNote: `${IMPORT_NOTE_PREFIX}; verify.`, status: "ARCHIVED" });
    await mk("hand-made", { sourceNote: "typed by hand" });
    await mk("no-note", {});
    const list = await listAdminProducts({ imported: true });
    expect(list.items.map((p) => p.slug)).toEqual(["imp-draft"]);
    expect((await listAdminProducts({})).total).toBe(4);
  });

  it("isImportedNote only matches the marker prefix", () => {
    expect(isImportedNote(`${IMPORT_NOTE_PREFIX} x`)).toBe(true);
    expect(isImportedNote(`x ${IMPORT_NOTE_PREFIX}`)).toBe(false);
    expect(isImportedNote(null)).toBe(false);
  });
});
