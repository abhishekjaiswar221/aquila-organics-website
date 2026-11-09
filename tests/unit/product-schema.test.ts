import { describe, expect, it } from "vitest";
import { assignUniqueSlugs, isReservedSlug, productInputSchema, slugify } from "@/features/products/schema";

describe("slugify", () => {
  it("derives a lowercase kebab slug", () => {
    expect(slugify("Aldehyde C-16 (Strawberry Aldehyde)")).toBe(
      "aldehyde-c-16-strawberry-aldehyde",
    );
  });

  it("is ASCII only and collapses punctuation", () => {
    expect(slugify("  Café -- Rhône / 80% DPG!! ")).toBe("cafe-rhone-80-dpg");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("***")).toBe("");
  });
});

describe("assignUniqueSlugs", () => {
  it("keeps unique slugs and suffixes later duplicates deterministically", () => {
    expect(assignUniqueSlugs(["a", "b", "a", "a"])).toEqual(["a", "b", "a-2", "a-3"]);
  });

  it("does not collide with an existing suffixed slug", () => {
    expect(assignUniqueSlugs(["a", "a", "a-2"])).toEqual(["a", "a-3", "a-2"]);
  });

  // /aroma-chemicals/documents/[id] is the document download route.
  it("never hands out a reserved slug: 'documents' is suffixed like a duplicate", () => {
    expect(isReservedSlug("documents")).toBe(true);
    expect(isReservedSlug("documents-2")).toBe(false);
    expect(assignUniqueSlugs(["documents"])).toEqual(["documents-2"]);
    expect(assignUniqueSlugs(["documents", "documents"])).toEqual(["documents-2", "documents-3"]);
    expect(assignUniqueSlugs(["documents", "documents-2"])).toEqual(["documents-3", "documents-2"]);
  });
});

describe("productInputSchema", () => {
  it("accepts a valid CAS and derives the slug", () => {
    const r = productInputSchema.safeParse({ name: "Ethyl Chloroacetate", casNumber: "105-39-5" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.slug).toBe("ethyl-chloroacetate");
      expect(r.data.casNumber).toBe("105-39-5");
    }
  });

  it("rejects 64-17-6 with a reason", () => {
    const r = productInputSchema.safeParse({ name: "Ethanol", casNumber: "64-17-6" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/CAS/i);
  });

  it("derives the example slug from the name", () => {
    const r = productInputSchema.safeParse({ name: "Aldehyde C-16 (Strawberry Aldehyde)" });
    expect(r.success && r.data.slug).toBe("aldehyde-c-16-strawberry-aldehyde");
  });

  it("keeps a supplied slug (normalised)", () => {
    const r = productInputSchema.safeParse({ name: "Padma", slug: "Padma-Special" });
    expect(r.success && r.data.slug).toBe("padma-special");
  });

  it("trims whitespace and treats blank optionals as absent", () => {
    const r = productInputSchema.safeParse({
      name: "  Padma  ",
      casNumber: "   ",
      code: " ",
      category: "  Aroma Chemicals ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Padma");
      expect(r.data.casNumber).toBeUndefined();
      expect(r.data.code).toBeUndefined();
      expect(r.data.category).toBe("Aroma Chemicals");
    }
  });

  it("requires a name", () => {
    expect(productInputSchema.safeParse({}).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an over-long name", () => {
    expect(productInputSchema.safeParse({ name: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects a name that yields no slug", () => {
    expect(productInputSchema.safeParse({ name: "***" }).success).toBe(false);
  });

  it("accepts specifications and applications", () => {
    const r = productInputSchema.safeParse({
      name: "Padma",
      specifications: [{ label: "Appearance", value: "Clear liquid" }],
      applications: ["Fine fragrance"],
    });
    expect(r.success).toBe(true);
  });
});
