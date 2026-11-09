import { describe, expect, it } from "vitest";
import { buildSitemap, robotsConfig } from "@/lib/seo/sitemap";

describe("buildSitemap", () => {
  it("lists the homepage, the catalogue and each product with absolute urls", () => {
    const when = new Date("2026-11-01T10:00:00Z");
    const entries = buildSitemap("https://example.test/", [
      { slug: "test-ethanol", lastModified: when },
      { slug: "test-water", lastModified: when },
    ]);
    expect(entries.map((e) => e.url)).toEqual([
      "https://example.test/",
      "https://example.test/aroma-chemicals",
      "https://example.test/aroma-chemicals/test-ethanol",
      "https://example.test/aroma-chemicals/test-water",
    ]);
    expect(entries[2].lastModified).toEqual(when);
  });

  it("percent-encodes slugs and never lists admin or api routes", () => {
    const entries = buildSitemap("https://example.test", [{ slug: "a b", lastModified: new Date(0) }]);
    expect(entries.at(-1)?.url).toBe("https://example.test/aroma-chemicals/a%20b");
    expect(entries.some((e) => /\/(admin|api)\b/.test(e.url))).toBe(false);
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
