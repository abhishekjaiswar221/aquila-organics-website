import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { importProducts } from "@/features/products/import";
import { isValidCas } from "@/lib/cas";
import { db, resetDb } from "./setup";

const legacy: unknown[] = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../data/legacy-products.json"), "utf8"),
);

beforeEach(async () => {
  await resetDb();
});

describe("importing the legacy catalogue", () => {
  it("creates 20 then updates 20 with no duplicates", async () => {
    const first = await importProducts(legacy, db);
    expect(first).toEqual({ created: 20, updated: 0, skipped: [] });
    const second = await importProducts(legacy, db);
    expect(second).toEqual({ created: 0, updated: 20, skipped: [] });
    expect(await db.product.count()).toBe(20);
  });

  it("stores every row as DRAFT and unverified", async () => {
    await importProducts(legacy, db);
    const products = await db.product.findMany();
    expect(products.every((p) => p.status === "DRAFT" && p.verified === false)).toBe(true);
    expect(products.every((p) => p.publishedAt === null)).toBe(true);
    expect(products.every((p) => p.sourceNote?.includes("verify against datasheet"))).toBe(true);
  });

  it("leaves CAS empty for the four conflicting rows", async () => {
    await importProducts(legacy, db);
    const names = [
      "Methyl Chloroacetate (MMCA)",
      "Hydratropic Alcohol",
      "Iso Bornyl Propionate",
      "Citronellyl Tiglate",
    ];
    const rows = await db.product.findMany({ where: { name: { in: names } } });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.casNumber).toBeNull();
      expect(row.casNormalized).toBeNull();
    }
  });

  it("stores only valid CAS numbers with matching digits", async () => {
    await importProducts(legacy, db);
    const withCas = await db.product.findMany({ where: { casNumber: { not: null } } });
    expect(withCas).toHaveLength(16);
    for (const p of withCas) {
      expect(isValidCas(p.casNumber ?? "")).toBe(true);
      expect(p.casNormalized).toBe((p.casNumber ?? "").replace(/-/g, ""));
    }
  });

  it("creates each category once, and no invented content", async () => {
    await importProducts(legacy, db);
    await importProducts(legacy, db);
    const cats = await db.category.findMany({ orderBy: { slug: "asc" } });
    expect(cats.map((c) => c.slug)).toEqual(["aroma-chemicals", "chloroacetates"]);
    expect(await db.productSpecification.count()).toBe(0);
    expect(await db.productApplication.count()).toBe(0);
    expect(await db.productDocument.count()).toBe(0);
    expect(await db.product.count({ where: { description: { not: null } } })).toBe(0);
    expect(await db.product.count({ where: { code: { not: null } } })).toBe(0);
  });
});

describe("importProducts behaviour", () => {
  it("skips a bad-CAS row while its neighbours import", async () => {
    const result = await importProducts(
      [
        { name: "Good One", casNumber: "105-39-5" },
        { name: "Bad Cas", casNumber: "64-17-6" },
        { name: "Good Two" },
      ],
      db,
    );
    expect(result.created).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.index).toBe(1);
    expect(result.skipped[0]?.reason).toMatch(/CAS/i);
    expect(await db.product.findUnique({ where: { slug: "bad-cas" } })).toBeNull();
  });

  it("skips non-object rows without aborting", async () => {
    const result = await importProducts([null, "x", { name: "Ok" }], db);
    expect(result.created).toBe(1);
    expect(result.skipped.map((s) => s.index)).toEqual([0, 1]);
  });

  it("gives duplicate names in one file distinct slugs", async () => {
    const result = await importProducts([{ name: "Twin" }, { name: "Twin" }], db);
    expect(result.created).toBe(2);
    const slugs = (await db.product.findMany({ orderBy: { slug: "asc" } })).map((p) => p.slug);
    expect(slugs).toEqual(["twin", "twin-2"]);
  });

  it("does not un-publish or un-verify an existing product on re-import", async () => {
    await importProducts([{ name: "Padma", casNumber: "101-48-4" }], db);
    const publishedAt = new Date();
    await db.product.update({
      where: { slug: "padma" },
      data: { status: "PUBLISHED", verified: true, publishedAt },
    });
    const result = await importProducts(
      [{ name: "Padma", casNumber: "101-48-4", sourceNote: "corrected" }],
      db,
    );
    expect(result).toEqual({ created: 0, updated: 1, skipped: [] });
    const p = await db.product.findUniqueOrThrow({ where: { slug: "padma" } });
    expect(p.status).toBe("PUBLISHED");
    expect(p.verified).toBe(true);
    expect(p.publishedAt?.getTime()).toBe(publishedAt.getTime());
    expect(p.sourceNote).toBe("corrected");
  });

  it("replaces specifications and applications only when supplied", async () => {
    await importProducts(
      [
        {
          name: "Padma",
          specifications: [{ label: "Appearance", value: "Clear" }],
          applications: ["Soap"],
        },
      ],
      db,
    );
    await importProducts([{ name: "Padma" }], db);
    expect(await db.productSpecification.count()).toBe(1);
    expect(await db.productApplication.count()).toBe(1);
    await importProducts(
      [{ name: "Padma", specifications: [{ label: "Colour", value: "Pale" }], applications: [] }],
      db,
    );
    const specs = await db.productSpecification.findMany();
    expect(specs.map((s) => s.label)).toEqual(["Colour"]);
    expect(await db.productApplication.count()).toBe(0);
  });

  it("reports a duplicate product code as skipped without aborting", async () => {
    const result = await importProducts(
      [
        { name: "One", code: "X1" },
        { name: "Two", code: "X1" },
        { name: "Three" },
      ],
      db,
    );
    expect(result.created).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.index).toBe(1);
  });
});
