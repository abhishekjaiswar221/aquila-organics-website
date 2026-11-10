import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

const state = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => state.headers,
}));

const { auth } = await import("@/lib/auth");
const { createCredentialUser } = await import("@/lib/admin-seed");
const { requireAction } = await import("@/lib/permissions");
const { recordAudit } = await import("@/features/admin/audit");
const { listAudit } = await import("@/features/admin/audit-queries");
const { setProductStatus, setProductVerified } = await import("@/features/products/admin-actions");
const { setEnquiryStatus } = await import("@/features/enquiries/admin-actions");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "CONTENT_EDITOR";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"];
const cookies = new Map<Role, string>();
const userIds = new Map<Role, string>();

const emailFor = (role: Role) => `audit-${role.toLowerCase().replace(/_/g, "-")}@admin.example.test`;
const passwordFor = (role: Role) => `TEST-${role.toLowerCase()}-passphrase`;
const signedInAs = (role: Role | null) => {
  state.headers = role ? new Headers({ cookie: cookies.get(role) ?? "" }) : new Headers();
};

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

afterAll(() => {
  signedInAs(null);
});

beforeEach(async () => {
  await db.auditLog.deleteMany();
  await db.enquiry.deleteMany();
  await db.product.deleteMany();
  signedInAs(null);
});

const makeProduct = (slug: string, verified = false) =>
  db.product.create({ data: { name: `TEST-${slug}`, slug, code: `TEST-${slug}`, verified } });

describe("recordAudit", () => {
  it("writes a row, sanitising detail and changed fields", async () => {
    await recordAudit({
      actorId: userIds.get("SUPER_ADMIN") ?? null,
      actorRole: "SUPER_ADMIN",
      action: "category.create",
      entityType: "category",
      outcome: "ok",
      changedFields: ["name", "name"],
      detail: { count: 1, email: "x@y.example", fullName: "Someone" },
    });
    const row = await db.auditLog.findFirstOrThrow();
    expect(row).toMatchObject({ changedFields: ["name"], detail: { count: 1 }, entityId: null });
  });

  it("rolls back with its transaction, leaving no row", async () => {
    await db
      .$transaction(async (tx) => {
        await recordAudit({ actorId: null, actorRole: "SUPER_ADMIN", action: "product.update", entityType: "product", outcome: "ok" }, tx);
        throw new Error("boom");
      })
      .catch(() => {});
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("audited admin actions", () => {
  it("publishing writes product.status with from and to", async () => {
    const p = await makeProduct("pub", true);
    signedInAs("SALES_MANAGER");
    expect(await setProductStatus(p.id, "PUBLISHED")).toEqual({ ok: true });
    const row = await db.auditLog.findFirstOrThrow({ where: { action: "product.status" } });
    expect(row).toMatchObject({
      outcome: "ok",
      entityType: "product",
      entityId: p.id,
      actorRole: "SALES_MANAGER",
      detail: { from: "DRAFT", to: "PUBLISHED" },
    });
  });

  it("a rejected publish of an unverified product writes outcome rejected", async () => {
    const p = await makeProduct("unverified");
    signedInAs("SALES_MANAGER");
    expect((await setProductStatus(p.id, "PUBLISHED")).ok).toBe(false);
    const rows = await db.auditLog.findMany({ where: { action: "product.status" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "rejected", entityId: p.id });
  });

  it("verifying writes product.verified", async () => {
    const p = await makeProduct("ver");
    signedInAs("SUPER_ADMIN");
    expect(await setProductVerified(p.id, true)).toEqual({ ok: true });
    const row = await db.auditLog.findFirstOrThrow({ where: { action: "product.verified" } });
    expect(row).toMatchObject({ outcome: "ok", entityId: p.id, detail: { from: false, to: true } });
  });

  it("an enquiry status change writes enquiry.status", async () => {
    const e = await db.enquiry.create({
      data: {
        reference: "AQ-2026-980001",
        type: "AROMA_CHEMICALS",
        fullName: "TEST Jane Buyer",
        companyName: "TEST Co",
        email: "jane@buyer.example",
        consentAt: new Date(),
      },
    });
    signedInAs("SALES_MANAGER");
    expect(await setEnquiryStatus(e.id, "CONTACTED")).toEqual({ ok: true });
    const row = await db.auditLog.findFirstOrThrow({ where: { action: "enquiry.status" } });
    expect(row).toMatchObject({ entityType: "enquiry", entityId: e.id, detail: { from: "NEW", to: "CONTACTED" } });
  });

  it("never stores an email address or a name in any audit row", async () => {
    const p = await makeProduct("pii", true);
    signedInAs("SUPER_ADMIN");
    await setProductStatus(p.id, "PUBLISHED");
    await setProductVerified(p.id, false);
    const rows = await db.auditLog.findMany();
    expect(rows.length).toBeGreaterThan(1);
    const json = JSON.stringify(rows);
    expect(json).not.toContain("@");
    expect(json).not.toContain("TEST-pii");
  });
});

describe("listAudit", () => {
  it("lists newest first and filters by action, entity type, actor and date range", async () => {
    const actor = userIds.get("SUPER_ADMIN") ?? null;
    const base = { actorId: actor, actorRole: "SUPER_ADMIN", outcome: "ok" } as const;
    await recordAudit({ ...base, action: "product.status", entityType: "product" });
    await recordAudit({ ...base, action: "enquiry.status", entityType: "enquiry" });
    await recordAudit({ ...base, action: "category.create", entityType: "category", actorId: null });

    const all = await listAudit({ page: 1 });
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => r.action)).toEqual(["category.create", "enquiry.status", "product.status"]);

    expect((await listAudit({ page: 1, action: "enquiry.status" })).rows.map((r) => r.action)).toEqual(["enquiry.status"]);
    expect((await listAudit({ page: 1, entityType: "product" })).total).toBe(1);
    expect((await listAudit({ page: 1, actorId: actor ?? undefined })).total).toBe(2);
    expect((await listAudit({ page: 1, action: "nope" as never })).total).toBe(3);
    expect((await listAudit({ page: 1, actorId: "not-a-uuid" })).total).toBe(3);
    expect((await listAudit({ page: 1, from: new Date(Date.now() + 60_000) })).total).toBe(0);
    expect((await listAudit({ page: 1, to: new Date(Date.now() - 60_000) })).total).toBe(0);
    expect((await listAudit({ page: 1, from: new Date(Date.now() - 60_000), to: new Date(Date.now() + 60_000) })).total).toBe(3);
    expect((await listAudit({ page: 1, from: new Date("invalid") })).total).toBe(3);
  });

  it("paginates 50 per page", async () => {
    await db.auditLog.createMany({
      data: Array.from({ length: 52 }, () => ({ actorRole: "SUPER_ADMIN", action: "product.update", entityType: "product", outcome: "ok" })),
    });
    expect((await listAudit({ page: 1 })).rows).toHaveLength(50);
    expect((await listAudit({ page: 2 })).rows).toHaveLength(2);
  });
});

describe("audit.view gate", () => {
  it("lets only SUPER_ADMIN through and refuses the others with 403", async () => {
    signedInAs("SUPER_ADMIN");
    await expect(requireAction("audit.view")).resolves.toMatchObject({ role: "SUPER_ADMIN" });
    for (const role of ["ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"] as const) {
      signedInAs(role);
      const error = await requireAction("audit.view").then(
        () => "resolved",
        (e: unknown) => e,
      );
      expect(error instanceof Error && "digest" in error ? String(error.digest) : String(error), role).toBe(
        "NEXT_HTTP_ERROR_FALLBACK;403",
      );
    }
  });
});
