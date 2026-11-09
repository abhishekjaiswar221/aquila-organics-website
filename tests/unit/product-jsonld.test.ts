import { describe, expect, it } from "vitest";
import type { ProductDetail } from "@/features/products/queries";
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd } from "@/lib/seo/product-jsonld";

const BASE = "https://example.test";

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
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
    ...overrides,
  };
}

describe("productJsonLd", () => {
  it("emits only name and url for a product with nothing else", () => {
    expect(productJsonLd(product(), BASE)).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "TEST-Ethanol",
      url: "https://example.test/aroma-chemicals/test-ethanol",
    });
  });

  it("omits casNumber, description, code and category when absent", () => {
    const json = JSON.stringify(productJsonLd(product(), BASE));
    for (const key of ["description", "sku", "category", "additionalProperty", "CAS"]) {
      expect(json).not.toContain(key);
    }
  });

  it("includes the fields that exist", () => {
    const ld = productJsonLd(
      product({
        code: "TEST-ETH-001",
        casNumber: "64-17-5",
        description: "A clearly fake fixture.",
        category: { slug: "test-solvents", name: "TEST-Solvents" },
        categoryName: "TEST-Solvents",
        specifications: [{ id: "s1", label: "Purity", value: "99.5 %", sortOrder: 0 }],
      }),
      BASE,
    );
    expect(ld).toMatchObject({
      sku: "TEST-ETH-001",
      description: "A clearly fake fixture.",
      category: "TEST-Solvents",
      additionalProperty: [
        { "@type": "PropertyValue", propertyID: "CAS", name: "CAS number", value: "64-17-5" },
        { "@type": "PropertyValue", name: "Purity", value: "99.5 %" },
      ],
    });
  });

  it("never emits offers, prices, brands, ratings or reviews", () => {
    const json = JSON.stringify(
      productJsonLd(product({ code: "X", casNumber: "64-17-5", description: "d" }), BASE),
    ).toLowerCase();
    for (const banned of ["offers", "price", "brand", "aggregaterating", "review", "manufacturer"]) {
      expect(json).not.toContain(banned);
    }
  });

  it("strips a trailing slash from the base url", () => {
    expect(productJsonLd(product(), `${BASE}/`)).toMatchObject({
      url: "https://example.test/aroma-chemicals/test-ethanol",
    });
  });
});

describe("breadcrumbJsonLd", () => {
  it("lists home, catalogue and product with absolute urls", () => {
    expect(breadcrumbJsonLd(product(), BASE)).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://example.test/" },
        { "@type": "ListItem", position: 2, name: "Aroma chemicals", item: "https://example.test/aroma-chemicals" },
        { "@type": "ListItem", position: 3, name: "TEST-Ethanol", item: "https://example.test/aroma-chemicals/test-ethanol" },
      ],
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapes characters that could close the script element", () => {
    const out = serializeJsonLd({ description: "</script><script>alert(1)</script> & \u{2028}" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("\u{2028}");
    expect(JSON.parse(out)).toEqual({ description: "</script><script>alert(1)</script> & \u{2028}" });
  });
});
