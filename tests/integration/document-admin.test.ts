import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

// Real users, sessions and requireAction(); fakes are the request headers and a
// temp-dir LocalStorage (optionally failing deletes).
const state = vi.hoisted(() => ({ headers: new Headers(), root: "", failDelete: false, failAudit: false }));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => state.headers,
}));

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  refresh: vi.fn(),
}));

// A failing audit write inside the insert transaction rolls the row back: the
// "row insert fails" case.
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

const { auth } = await import("@/lib/auth");
const { createCredentialUser } = await import("@/lib/admin-seed");
const { uploadProductDocument, deleteProductDocument } = await import("@/features/products/document-actions");
const { getPublishedDocumentFile } = await import("@/features/products/document-queries");
const { LocalStorage } = await import("@/lib/storage/local");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "SALES_EXECUTIVE" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "SALES_EXECUTIVE", "CONTENT_EDITOR", "HR_MANAGER"];
const cookies = new Map<Role, string>();

const emailFor = (role: Role) => `test-${role.toLowerCase().replace(/_/g, "-")}@admin.example.test`;
const passwordFor = (role: Role) => `TEST-${role.toLowerCase()}-passphrase`;

function signedInAs(role: Role | null): void {
  state.headers = role ? new Headers({ cookie: cookies.get(role) ?? "" }) : new Headers();
}

function digestOf(error: unknown): string {
  return error instanceof Error && "digest" in error ? String(error.digest) : String(error);
}

async function rejection(run: () => Promise<unknown>): Promise<string> {
  return run().then(
    () => "resolved",
    (e: unknown) => digestOf(e),
  );
}

const PDF = () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46]);

function form(fields: { productId?: string; kind?: string; title?: string; file?: File | null }): FormData {
  const fd = new FormData();
  if (fields.productId !== undefined) fd.set("productId", fields.productId);
  if (fields.kind !== undefined) fd.set("kind", fields.kind);
  if (fields.title !== undefined) fd.set("title", fields.title);
  if (fields.file) fd.set("file", fields.file);
  return fd;
}

const pdfFile = (name = "sheet.pdf") => new File([PDF()], name, { type: "application/pdf" });

async function makeProduct(slug: string, status: "DRAFT" | "PUBLISHED" = "DRAFT") {
  return db.product.create({
    data: {
      name: `TEST-${slug}`,
      slug,
      status,
      verified: status === "PUBLISHED",
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
}

const objects = () => readdir(state.root).catch(() => [] as string[]);
const auditFor = (action: string) => db.auditLog.findMany({ where: { action }, orderBy: { at: "asc" } });

async function expectNothingStored() {
  expect(await db.productDocument.count()).toBe(0);
  expect(await objects()).toEqual([]);
  expect(await db.auditLog.count({ where: { action: { in: ["document.upload", "document.delete"] } } })).toBe(0);
}

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-docs-"));
  await resetDb();
  for (const role of ROLES) {
    await createCredentialUser({ email: emailFor(role), password: passwordFor(role), role });
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
  await db.product.deleteMany();
  await rm(state.root, { recursive: true, force: true });
  state.failDelete = false;
  state.failAudit = false;
  signedInAs("CONTENT_EDITOR");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadProductDocument", () => {
  it("stores a valid PDF under an opaque key, inserts the row and audits it", async () => {
    const p = await makeProduct("doc-ok");
    const result = await uploadProductDocument(
      null,
      form({ productId: p.id, kind: "SDS", title: "  TEST   sheet ", file: pdfFile("../evil name.pdf") }),
    );
    expect(result).toEqual({ ok: true, message: "Document uploaded." });

    const rows = await db.productDocument.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: p.id, kind: "SDS", title: "TEST sheet", mimeType: "application/pdf" });
    expect(rows[0].storageKey).toMatch(/^doc-[A-Za-z0-9_-]{43}$/);
    expect(await objects()).toEqual([rows[0].storageKey]);
    const stored = await new LocalStorage(state.root).getStream(rows[0].storageKey);
    expect(new Uint8Array(await new Response(stored).arrayBuffer())).toEqual(PDF());

    const audit = await auditFor("document.upload");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entityType: "document", entityId: rows[0].id, outcome: "ok", actorRole: "CONTENT_EDITOR" });
    expect(audit[0].detail).toEqual({ kind: "SDS" });
  });

  it("rejects an exe renamed .pdf", async () => {
    const p = await makeProduct("doc-exe");
    const exe = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0])], "setup.pdf");
    const r = await uploadProductDocument(null, form({ productId: p.id, kind: "DATASHEET", title: "T", file: exe }));
    expect(r?.ok).toBe(false);
    expect(r?.message).not.toMatch(/setup/);
    await expectNothingStored();
  });

  it("rejects an empty file and a missing file", async () => {
    const p = await makeProduct("doc-empty");
    const empty = form({ productId: p.id, kind: "SDS", title: "T", file: new File([], "a.pdf") });
    expect((await uploadProductDocument(null, empty))?.ok).toBe(false);
    expect((await uploadProductDocument(null, form({ productId: p.id, kind: "SDS", title: "T" })))?.ok).toBe(false);
    await expectNothingStored();
  });

  it("rejects a file over 10 MB", async () => {
    const p = await makeProduct("doc-big");
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF());
    const r = await uploadProductDocument(
      null,
      form({ productId: p.id, kind: "SDS", title: "T", file: new File([big], "big.pdf") }),
    );
    expect(r).toEqual({ ok: false, message: "File is larger than 10 MB." });
    await expectNothingStored();
  });

  it("rejects a kind outside DATASHEET, SDS and OTHER", async () => {
    const p = await makeProduct("doc-kind");
    for (const kind of ["", "datasheet", "ADMIN", "RFQ"]) {
      const r = await uploadProductDocument(null, form({ productId: p.id, kind, title: "T", file: pdfFile() }));
      // The allow-list answers before anything is stored (the database enum is only a backstop).
      expect(r).toEqual({ ok: false, message: "Choose a document type." });
    }
    await expectNothingStored();
  });

  it("rejects a blank or over-long title", async () => {
    const p = await makeProduct("doc-title");
    for (const title of ["", "   \n\t ", "x".repeat(201)]) {
      const r = await uploadProductDocument(null, form({ productId: p.id, kind: "SDS", title, file: pdfFile() }));
      expect(r?.ok).toBe(false);
    }
    await expectNothingStored();
  });

  it("rejects an unknown or malformed product", async () => {
    for (const productId of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const r = await uploadProductDocument(null, form({ productId, kind: "SDS", title: "T", file: pdfFile() }));
      expect(r).toEqual({ ok: false, message: "Product not found." });
    }
    await expectNothingStored();
  });

  it("removes the stored object when the row insert fails", async () => {
    const p = await makeProduct("doc-rollback");
    state.failAudit = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await uploadProductDocument(null, form({ productId: p.id, kind: "SDS", title: "T", file: pdfFile() }));
    expect(r?.ok).toBe(false);
    await expectNothingStored();
  });

  it("is refused for SALES_MANAGER, SALES_EXECUTIVE and HR_MANAGER, and redirects when signed out", async () => {
    const p = await makeProduct("doc-roles");
    const run = () => uploadProductDocument(null, form({ productId: p.id, kind: "SDS", title: "T", file: pdfFile() }));
    for (const role of ["SALES_MANAGER", "SALES_EXECUTIVE", "HR_MANAGER"] as const) {
      signedInAs(role);
      expect(await rejection(run)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    }
    signedInAs(null);
    expect(await rejection(run)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;307;/);
    await expectNothingStored();
  });

  it("is allowed for ADMINISTRATOR, CONTENT_EDITOR and SUPER_ADMIN", async () => {
    const p = await makeProduct("doc-allowed");
    for (const role of ["ADMINISTRATOR", "CONTENT_EDITOR", "SUPER_ADMIN"] as const) {
      signedInAs(role);
      const r = await uploadProductDocument(null, form({ productId: p.id, kind: "OTHER", title: role, file: pdfFile() }));
      expect(r?.ok).toBe(true);
    }
    expect(await db.productDocument.count()).toBe(3);
  });
});

async function upload(productId: string) {
  await uploadProductDocument(null, form({ productId, kind: "DATASHEET", title: "TEST doc", file: pdfFile() }));
  return db.productDocument.findFirstOrThrow({ where: { productId } });
}

describe("deleteProductDocument", () => {
  it("removes the row and the object and audits document.delete", async () => {
    const p = await makeProduct("del-ok");
    const row = await upload(p.id);
    const fd = new FormData();
    fd.set("id", row.id);
    expect(await deleteProductDocument(null, fd)).toEqual({ ok: true, message: "Document deleted." });
    expect(await db.productDocument.count()).toBe(0);
    expect(await objects()).toEqual([]);
    const audit = await auditFor("document.delete");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entityId: row.id, outcome: "ok" });
    expect(audit[0].detail).toEqual({ kind: "DATASHEET" });
  });

  it("keeps the row deleted and audits a storage failure", async () => {
    const p = await makeProduct("del-fail");
    const row = await upload(p.id);
    state.failDelete = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fd = new FormData();
    fd.set("id", row.id);
    expect((await deleteProductDocument(null, fd))?.ok).toBe(true);
    expect(await db.productDocument.count()).toBe(0);
    const audit = await auditFor("document.delete");
    expect(audit.map((a) => a.detail)).toContainEqual({ storageCleanup: "failed" });
  });

  it("answers an unknown id without writing", async () => {
    const fd = new FormData();
    fd.set("id", "00000000-0000-4000-8000-000000000000");
    expect((await deleteProductDocument(null, fd))?.ok).toBe(false);
    expect(await db.auditLog.count({ where: { action: "document.delete" } })).toBe(0);
  });

  it("is refused for SALES_MANAGER and HR_MANAGER and redirects when signed out", async () => {
    const p = await makeProduct("del-roles");
    const row = await upload(p.id);
    const fd = new FormData();
    fd.set("id", row.id);
    for (const role of ["SALES_MANAGER", "HR_MANAGER"] as const) {
      signedInAs(role);
      expect(await rejection(() => deleteProductDocument(null, fd))).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    }
    signedInAs(null);
    expect(await rejection(() => deleteProductDocument(null, fd))).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;307;/);
    expect(await db.productDocument.count()).toBe(1);
    expect(await objects()).toHaveLength(1);
  });
});

describe("public visibility of uploaded documents", () => {
  it("is not served while the product is a draft, and is once published", async () => {
    const p = await makeProduct("vis");
    const row = await upload(p.id);
    expect(await getPublishedDocumentFile(row.id)).toBeNull();
    await db.product.update({ where: { id: p.id }, data: { status: "PUBLISHED", verified: true, publishedAt: new Date() } });
    expect(await getPublishedDocumentFile(row.id)).toMatchObject({ id: row.id, storageKey: row.storageKey });
  });
});
