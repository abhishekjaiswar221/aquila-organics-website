import { beforeEach, describe, expect, it } from "vitest";
import {
  getPublishedProduct,
  getRelatedProducts,
  searchProducts,
} from "@/features/products/queries";
import { db, resetDb } from "./setup";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

let seq = 0;

async function makeCategory(slug: string, name: string) {
  return db.category.create({ data: { slug, name } });
}

async function makeProduct(
  name: string,
  opts: {
    status?: Status;
    code?: string;
    cas?: string;
    categoryId?: string;
    publishedAt?: Date;
    slug?: string;
  } = {},
) {
  const status = opts.status ?? "PUBLISHED";
  seq += 1;
  return db.product.create({
    data: {
      name,
      slug: opts.slug ?? `test-${seq}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      code: opts.code,
      casNumber: opts.cas,
      casNormalized: opts.cas ? opts.cas.replace(/-/g, "") : null,
      categoryId: opts.categoryId,
      status,
      verified: status === "PUBLISHED",
      publishedAt: status === "PUBLISHED" ? (opts.publishedAt ?? new Date()) : null,
      sourceNote: "internal note",
    },
  });
}

beforeEach(async () => {
  await resetDb();
  seq = 0;
});

describe("visibility", () => {
  it("never returns draft or archived products from any path", async () => {
    const cat = await makeCategory("test-cat", "TEST Cat");
    const pub = await makeProduct("TEST-Ethanol Pub", { cas: "64-17-5", code: "TEST-E1", categoryId: cat.id });
    const draft = await makeProduct("TEST-Ethanol Draft", {
      status: "DRAFT", cas: "64-17-5", code: "TEST-E2", categoryId: cat.id,
    });
    const arch = await makeProduct("TEST-Ethanol Arch", {
      status: "ARCHIVED", cas: "64-17-5", code: "TEST-E3", categoryId: cat.id,
    });

    for (const q of ["64-17-5", "64175", "TEST-Ethanol", "TEST-E"]) {
      const r = await searchProducts({ q });
      expect(r.items.map((i) => i.id), q).toEqual([pub.id]);
      expect(r.total).toBe(1);
    }
    const all = await searchProducts({});
    expect(all.items.map((i) => i.id)).toEqual([pub.id]);
    expect(all.categories).toEqual([{ slug: "test-cat", name: "TEST Cat", count: 1 }]);

    expect(await getPublishedProduct(draft.slug)).toBeNull();
    expect(await getPublishedProduct(arch.slug)).toBeNull();
    expect((await getPublishedProduct(pub.slug))?.id).toBe(pub.id);

    expect(await getRelatedProducts(pub.id, 12)).toEqual([]);
    expect(await getRelatedProducts(draft.id, 12)).toEqual([]);
  });
});

describe("CAS search", () => {
  it("matches hyphenated and bare CAS, and not a different CAS", async () => {
    const p = await makeProduct("TEST-Ethanol", { cas: "64-17-5" });
    await makeProduct("TEST-Water", { cas: "7732-18-5" });
    expect((await searchProducts({ q: "64-17-5" })).items.map((i) => i.id)).toEqual([p.id]);
    expect((await searchProducts({ q: "64175" })).items.map((i) => i.id)).toEqual([p.id]);
    expect((await searchProducts({ q: "67-56-1" })).items).toEqual([]);
    expect((await searchProducts({ q: "64-17-5" })).items[0].casNumber).toBe("64-17-5");
  });
});

describe("text search", () => {
  it("matches name fragment case-insensitively and by code", async () => {
    const p = await makeProduct("TEST-Benzyl Acetate", { code: "TEST-BA-01" });
    await makeProduct("TEST-Other");
    expect((await searchProducts({ q: "benzyl ACE" })).items.map((i) => i.id)).toEqual([p.id]);
    expect((await searchProducts({ q: "ba-01" })).items.map((i) => i.id)).toEqual([p.id]);
  });

  it("treats %, _ and backslash literally", async () => {
    const pct = await makeProduct("TEST-100% pure");
    const us = await makeProduct("TEST-a_b");
    const bs = await makeProduct("TEST-c\\d");
    await makeProduct("TEST-unrelated");
    await makeProduct("TEST-aXb");
    expect((await searchProducts({ q: "100%" })).items.map((i) => i.id)).toEqual([pct.id]);
    expect((await searchProducts({ q: "%" })).items.map((i) => i.id)).toEqual([pct.id]);
    expect((await searchProducts({ q: "a_b" })).items.map((i) => i.id)).toEqual([us.id]);
    expect((await searchProducts({ q: "_" })).items.map((i) => i.id)).toEqual([us.id]);
    expect((await searchProducts({ q: "\\" })).items.map((i) => i.id)).toEqual([bs.id]);
    expect((await searchProducts({ q: "c\\d" })).items.map((i) => i.id)).toEqual([bs.id]);
  });

  it("returns nothing for a lone % when no name contains it", async () => {
    await makeProduct("TEST-plain");
    expect((await searchProducts({ q: "%" })).items).toEqual([]);
    expect((await searchProducts({ q: "_" })).items).toEqual([]);
  });

  it("survives long, NUL, quote and unicode queries", async () => {
    const p = await makeProduct("TEST-Caf\u{e9} O'Neil \u{4e2d}");
    await expect(searchProducts({ q: "x".repeat(500) })).resolves.toMatchObject({ total: 0 });
    await expect(searchProducts({ q: "ab\u{0}cd" })).resolves.toMatchObject({ total: 0 });
    await expect(searchProducts({ q: "\u{0}" })).resolves.toMatchObject({ total: 1 });
    await expect(searchProducts({ q: "'; DROP TABLE product; --" })).resolves.toMatchObject({ total: 0 });
    expect((await searchProducts({ q: "O'Neil" })).items.map((i) => i.id)).toEqual([p.id]);
    expect((await searchProducts({ q: "\u{4e2d}" })).items.map((i) => i.id)).toEqual([p.id]);
    expect((await searchProducts({ q: "   " })).total).toBe(1);
  });
});

describe("categories", () => {
  it("filters, counts only published, ignores own filter, reflects the text query", async () => {
    const a = await makeCategory("test-a", "TEST A");
    const b = await makeCategory("test-b", "TEST B");
    await makeCategory("test-empty", "TEST Empty");
    await makeProduct("TEST-Apple", { categoryId: a.id });
    await makeProduct("TEST-Apricot", { categoryId: a.id });
    await makeProduct("TEST-Apple Draft", { categoryId: a.id, status: "DRAFT" });
    await makeProduct("TEST-Banana", { categoryId: b.id });
    await makeProduct("TEST-Apex", { categoryId: b.id });

    const filtered = await searchProducts({ category: "test-a" });
    expect(filtered.items.map((i) => i.name)).toEqual(["TEST-Apple", "TEST-Apricot"]);
    expect(filtered.total).toBe(2);
    expect(filtered.categories).toEqual([
      { slug: "test-a", name: "TEST A", count: 2 },
      { slug: "test-b", name: "TEST B", count: 2 },
    ]);
    expect(filtered.items[0].categoryName).toBe("TEST A");

    const q = await searchProducts({ q: "ap", category: "test-a" });
    expect(q.categories).toEqual([
      { slug: "test-a", name: "TEST A", count: 2 },
      { slug: "test-b", name: "TEST B", count: 1 },
    ]);

    const unknown = await searchProducts({ category: "nope" });
    expect(unknown.items).toEqual([]);
    expect(unknown.total).toBe(0);
  });
});

describe("pagination", () => {
  beforeEach(async () => {
    for (let i = 0; i < 25; i++) {
      await makeProduct(`TEST-P${String(i).padStart(2, "0")}`);
    }
  });

  it("pages at 24 with no duplicates", async () => {
    const p1 = await searchProducts({});
    const p2 = await searchProducts({ page: 2 });
    const p3 = await searchProducts({ page: 3 });
    expect(p1.items).toHaveLength(24);
    expect(p2.items).toHaveLength(1);
    expect(p3.items).toEqual([]);
    expect([p1.total, p2.total, p3.total]).toEqual([25, 25, 25]);
    expect([p1.pageCount, p3.pageCount]).toEqual([2, 2]);
    expect(p3.page).toBe(3);
    const ids = [...p1.items, ...p2.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(25);
  });

  it("handles NaN, negative, fractional and huge pages", async () => {
    expect((await searchProducts({ page: Number.NaN })).page).toBe(1);
    expect((await searchProducts({ page: -4 })).page).toBe(1);
    expect((await searchProducts({ page: 0 })).page).toBe(1);
    expect((await searchProducts({ page: 1.5 })).page).toBe(1);
    const huge = await searchProducts({ page: 1e9 });
    expect(huge.items).toEqual([]);
    expect(huge.pageCount).toBe(2);
    const inf = await searchProducts({ page: Number.POSITIVE_INFINITY });
    expect(inf.page).toBe(1);
  });

  it("has pageCount 1 for no results", async () => {
    const r = await searchProducts({ q: "zzzzzz" });
    expect(r).toMatchObject({ total: 0, pageCount: 1, page: 1, items: [] });
  });

  it("keeps a stable order for identical names", async () => {
    await resetDb();
    for (let i = 0; i < 30; i++) await makeProduct("TEST-Same", { slug: `test-same-${String(i).padStart(2, "0")}` });
    const a = await searchProducts({ page: 1 });
    const b = await searchProducts({ page: 2 });
    const ids = [...a.items, ...b.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(30);
  });
});

describe("sorting", () => {
  it("sorts by name asc/desc/newest and falls back on unknown", async () => {
    await makeProduct("TEST-B", { publishedAt: new Date("2026-01-02") });
    await makeProduct("TEST-A", { publishedAt: new Date("2026-01-01") });
    await makeProduct("TEST-C", { publishedAt: new Date("2026-01-03") });
    const names = async (sort?: string) =>
      (await searchProducts({ sort: sort as "name-asc" })).items.map((i) => i.name);
    expect(await names()).toEqual(["TEST-A", "TEST-B", "TEST-C"]);
    expect(await names("name-asc")).toEqual(["TEST-A", "TEST-B", "TEST-C"]);
    expect(await names("name-desc")).toEqual(["TEST-C", "TEST-B", "TEST-A"]);
    expect(await names("newest")).toEqual(["TEST-C", "TEST-B", "TEST-A"]);
    expect(await names("bogus")).toEqual(["TEST-A", "TEST-B", "TEST-C"]);
  });
});

describe("detail", () => {
  it("returns ordered specs, applications and documents without storageKey", async () => {
    const cat = await makeCategory("test-cat", "TEST Cat");
    const p = await makeProduct("TEST-Detail", { categoryId: cat.id, cas: "64-17-5" });
    await db.productSpecification.createMany({
      data: [
        { productId: p.id, label: "Second", value: "2", sortOrder: 2 },
        { productId: p.id, label: "First", value: "1", sortOrder: 1 },
      ],
    });
    await db.productApplication.create({ data: { productId: p.id, name: "Solvent" } });
    await db.productDocument.create({
      data: { productId: p.id, kind: "SDS", title: "SDS", storageKey: "secret/key.pdf", mimeType: "application/pdf" },
    });
    const d = await getPublishedProduct(p.slug);
    expect(d?.specifications.map((s) => s.label)).toEqual(["First", "Second"]);
    expect(d?.applications.map((a) => a.name)).toEqual(["Solvent"]);
    expect(d?.category).toEqual({ slug: "test-cat", name: "TEST Cat" });
    expect(d?.documents).toHaveLength(1);
    expect(Object.keys(d!.documents[0]).sort()).toEqual(["id", "kind", "mimeType", "title"]);
    expect(JSON.stringify(d)).not.toContain("secret/key.pdf");
    expect(JSON.stringify(d)).not.toContain("internal note");
    expect(await getPublishedProduct("unknown")).toBeNull();
  });

  it("list items carry no internal fields", async () => {
    await makeProduct("TEST-Item");
    const item = (await searchProducts({})).items[0];
    expect(Object.keys(item).sort()).toEqual(["casNumber", "categoryName", "code", "id", "name", "slug"]);
  });
});

describe("related products", () => {
  it("returns same-category published others, excluding self and drafts", async () => {
    const a = await makeCategory("test-a", "TEST A");
    const b = await makeCategory("test-b", "TEST B");
    const self = await makeProduct("TEST-Self", { categoryId: a.id });
    const r1 = await makeProduct("TEST-R1", { categoryId: a.id });
    const r2 = await makeProduct("TEST-R2", { categoryId: a.id });
    await makeProduct("TEST-RD", { categoryId: a.id, status: "DRAFT" });
    await makeProduct("TEST-Other", { categoryId: b.id });
    const lone = await makeProduct("TEST-Lone");

    expect((await getRelatedProducts(self.id, 12)).map((p) => p.id)).toEqual([r1.id, r2.id]);
    expect(await getRelatedProducts(self.id, 1)).toHaveLength(1);
    expect(await getRelatedProducts(self.id, 0)).toHaveLength(1);
    expect(await getRelatedProducts(self.id, 999)).toHaveLength(2);
    expect(await getRelatedProducts(lone.id, 12)).toEqual([]);
    expect(await getRelatedProducts("00000000-0000-0000-0000-000000000000", 12)).toEqual([]);
  });
});
