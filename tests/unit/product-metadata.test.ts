import { describe, expect, it } from "vitest";
import type { ProductDetail } from "@/features/products/queries";
import { productMetadata } from "@/lib/seo/product-metadata";

const base: ProductDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "test-ethanol",
  name: "TEST-Ethanol",
  code: null,
  casNumber: null,
  categoryName: null,
  description: null,
  seoTitle: null,
  seoDescription: null,
  publishedAt: null,
  category: null,
  specifications: [],
  applications: [],
  documents: [],
};

describe("productMetadata", () => {
  it("prefers the SEO fields", () => {
    const m = productMetadata({ ...base, seoTitle: "TEST title", seoDescription: "TEST description" });
    expect(m.title).toBe("TEST title");
    expect(m.description).toBe("TEST description");
  });

  it("builds title and description from existing fields only", () => {
    const m = productMetadata({ ...base, code: "TEST-1", casNumber: "64-17-5" });
    expect(m.title).toBe("TEST-Ethanol (CAS 64-17-5)");
    expect(m.description).toBe(
      "TEST-Ethanol (product code TEST-1, CAS 64-17-5): aroma chemical from Aquila Organics. Request a quotation.",
    );
    const bare = productMetadata(base);
    expect(bare.title).toBe("TEST-Ethanol");
    expect(bare.description).not.toMatch(/CAS|code|undefined|null/);
  });

  it("uses a truncated product description when present", () => {
    const m = productMetadata({ ...base, description: `${"word ".repeat(60)}end` });
    expect(String(m.description).length).toBeLessThanOrEqual(160);
    expect(String(m.description).endsWith("\u{2026}")).toBe(true);
  });

  it("is canonical to the product URL and indexable", () => {
    const m = productMetadata(base);
    expect(m.alternates?.canonical).toBe("/aroma-chemicals/test-ethanol");
    expect(m.robots).toEqual({ index: true, follow: true });
  });
});
