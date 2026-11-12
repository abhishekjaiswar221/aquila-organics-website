import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_DESCRIPTION_PREFIX, DEMO_NOTE_PREFIX, validateSampleRows } from "@/features/demo/seed";
import { assignUniqueSlugs, productInputSchema } from "@/features/products/schema";
import { isValidCas } from "@/lib/cas";
import { robotsConfig } from "@/lib/seo/sitemap";

const rows: unknown = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/demo-products.json"), "utf8"));
const parsed = (Array.isArray(rows) ? rows : []).map((r) => productInputSchema.safeParse(r));

describe("demo sample catalogue (data/demo-products.json)", () => {
  it("has enough products to demonstrate search and filtering", () => {
    expect(Array.isArray(rows) && rows.length).toBeGreaterThanOrEqual(15);
  });

  it("every row passes the same validation the admin uses, including the CAS check digit", () => {
    for (const [i, r] of parsed.entries()) expect(r.success, `row ${i + 1}`).toBe(true);
    for (const r of parsed) {
      if (r.success) {
        expect(r.data.casNumber, r.data.name).toBeDefined();
        expect(isValidCas(r.data.casNumber ?? ""), r.data.name).toBe(true);
      }
    }
  });

  it("has no duplicate names, slugs or CAS numbers", () => {
    const ok = parsed.flatMap((r) => (r.success ? [r.data] : []));
    expect(new Set(ok.map((p) => p.name.toLowerCase())).size).toBe(ok.length);
    expect(new Set(ok.map((p) => p.casNumber)).size).toBe(ok.length);
    const slugs = ok.map((p) => p.slug);
    expect(assignUniqueSlugs(slugs)).toEqual(slugs);
  });

  it("marks every row as sample data, in its note and in its public description", () => {
    expect(() => validateSampleRows(rows)).not.toThrow();
    for (const p of parsed.flatMap((r) => (r.success ? [r.data] : []))) {
      expect(p.sourceNote?.startsWith(DEMO_NOTE_PREFIX), p.name).toBe(true);
      expect(p.description?.startsWith(DEMO_DESCRIPTION_PREFIX), p.name).toBe(true);
    }
  });

  it("never presents a sample as an Aquila product or claims capacity, certification or customers", () => {
    const text = JSON.stringify(rows).toLowerCase();
    for (const banned of ["certified", "iso ", "gmp", "kosher", "halal", "customers", "capacity", "tons", "tonnes"]) {
      expect(text, banned).not.toContain(banned);
    }
    // "our" as a word (a first-person claim), not inside "flavour".
    expect(text).not.toMatch(/our/);
    expect(text).toContain("not an aquila organics product listing");
  });
});

describe("validateSampleRows", () => {
  const good = { name: "X", description: `${DEMO_DESCRIPTION_PREFIX} y`, sourceNote: `${DEMO_NOTE_PREFIX} z` };

  it("rejects a row that is not marked as sample data, so a real product can never be loaded by mistake", () => {
    expect(() => validateSampleRows([good, { ...good, sourceNote: "from the real catalogue" }])).toThrow(/row 2/);
    expect(() => validateSampleRows([{ ...good, description: "A real description" }])).toThrow(/row 1/);
    expect(() => validateSampleRows([{ name: "no note" }])).toThrow();
    expect(() => validateSampleRows({})).toThrow();
  });
});

describe("robotsConfig with the demo noindex setting", () => {
  it("disallows the whole site and offers no sitemap", () => {
    expect(robotsConfig("https://demo.example.test", { noindex: true })).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    });
  });

  it("is unchanged without the setting", () => {
    expect(robotsConfig("https://example.test/")).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
      sitemap: "https://example.test/sitemap.xml",
    });
    expect(robotsConfig("https://example.test/", { noindex: false })).toEqual(robotsConfig("https://example.test/"));
  });
});
