import { describe, expect, it } from "vitest";
import { buildSitemap, robotsConfig } from "@/lib/seo/sitemap";

describe("buildSitemap", () => {
  it("lists the homepage, catalogue, both segments with every application, each product and the privacy notice with absolute urls", () => {
    const when = new Date("2026-11-01T10:00:00Z");
    const entries = buildSitemap("https://example.test/", [
      { slug: "test-ethanol", lastModified: when },
      { slug: "test-water", lastModified: when },
    ]);
    expect(entries.map((e) => e.url)).toEqual([
      "https://example.test/",
      "https://example.test/aroma-chemicals",
      "https://example.test/fragrances",
      "https://example.test/fragrances/fine-fragrance",
      "https://example.test/fragrances/personal-care",
      "https://example.test/fragrances/air-care",
      "https://example.test/fragrances/fabric-care",
      "https://example.test/fragrances/home-care",
      "https://example.test/fragrances/incense-and-bakhoor",
      "https://example.test/flavours",
      "https://example.test/flavours/confectionery",
      "https://example.test/flavours/bakery",
      "https://example.test/flavours/beverages",
      "https://example.test/flavours/dairy",
      "https://example.test/flavours/savoury",
      "https://example.test/about",
      "https://example.test/innovation",
      "https://example.test/sustainability",
      "https://example.test/sustainability/compliance",
      "https://example.test/aroma-chemicals/test-ethanol",
      "https://example.test/aroma-chemicals/test-water",
      "https://example.test/privacy",
    ]);
    expect(entries.find((e) => e.url.endsWith("/test-ethanol"))?.lastModified).toEqual(when);
  });

  it("percent-encodes slugs and never lists admin or api routes", () => {
    const entries = buildSitemap("https://example.test", [{ slug: "a b", lastModified: new Date(0) }]);
    expect(entries.at(-2)?.url).toBe("https://example.test/aroma-chemicals/a%20b");
    expect(entries.some((e) => /\/(admin|api)\b/.test(e.url))).toBe(false);
  });
});

describe("buildSitemap certifications page", () => {
  const certUrl = "https://example.test/sustainability/certifications";

  it("omits the certifications page by default and when it is not indexable", () => {
    expect(buildSitemap("https://example.test", []).map((e) => e.url)).not.toContain(certUrl);
    expect(
      buildSitemap("https://example.test", [], { certificationsIndexable: false }).map((e) => e.url),
    ).not.toContain(certUrl);
  });

  it("lists it, right after the compliance page, once it is indexable", () => {
    const urls = buildSitemap("https://example.test", [], { certificationsIndexable: true }).map((e) => e.url);
    const i = urls.indexOf("https://example.test/sustainability/compliance");
    expect(urls[i + 1]).toBe(certUrl);
  });
});

describe("robotsConfig", () => {
  it("allows the site, disallows admin and api, and points at the sitemap", () => {
    expect(robotsConfig("https://example.test/")).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
      sitemap: "https://example.test/sitemap.xml",
    });
  });
});
