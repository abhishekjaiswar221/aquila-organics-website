import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { redirectRules, redirectTable } from "@/content/redirects";
import { buildSitemap } from "@/lib/seo/sitemap";

/** Every URL the new site serves as a real page: the indexable pages plus the ones kept out of the sitemap. */
const LIVE = new Set<string>([
  ...buildSitemap("https://example.test", [], { certificationsIndexable: true }).map((e) => new URL(e.url).pathname),
  "/rfq",
  // Careers: /careers is in the sitemap; the apply form is live but not indexable.
  "/careers/apply",
]);

describe("redirect table", () => {
  const sources = redirectRules.map((r) => r.source);
  const destinations = redirectRules.map((r) => r.destination);

  it("has unique sources", () => {
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("never redirects a URL to itself", () => {
    for (const r of redirectRules) expect(r.source, r.source).not.toBe(r.destination);
  });

  it("has no chains or loops: no destination is itself a redirect source", () => {
    const set = new Set(sources);
    for (const d of destinations) expect(set.has(d), d).toBe(false);
  });

  it("only points at pages that exist on the new site", () => {
    for (const d of destinations) expect(LIVE.has(d), d).toBe(true);
  });

  it("never shadows a live page", () => {
    for (const s of sources) expect(LIVE.has(s), s).toBe(false);
  });

  it("stays away from admin, api and framework paths", () => {
    for (const s of sources) expect(s, s).not.toMatch(/^\/(admin|api|_next)(\/|$)/);
  });

  it("uses absolute paths without query strings or trailing slashes", () => {
    for (const r of redirectRules) {
      for (const p of [r.source, r.destination]) {
        expect(p, p).toMatch(/^\/$|^\/[A-Za-z0-9\-_./]*[A-Za-z0-9]$/);
        expect(p, p).not.toContain("?");
      }
    }
  });
});

describe("/index.php variants", () => {
  it("adds one variant per clean rule with the same destination", () => {
    // One extra rule: the old home URL /index.php itself.
    expect(redirectRules).toHaveLength(redirectTable.length * 2 + 1);
    expect(redirectRules.find((x) => x.source === "/index.php")?.destination).toBe("/");
    for (const r of redirectTable) {
      const variant = redirectRules.find((x) => x.source === `/index.php${r.source}`);
      expect(variant?.destination, r.source).toBe(r.destination);
    }
  });
});

describe("old pages that moved", () => {
  const byPath = (source: string) => redirectTable.find((r) => r.source === source)?.destination;

  it("maps the old URLs from the migration plan to their new homes", () => {
    expect(byPath("/fragrance")).toBe("/fragrances");
    expect(byPath("/flavors")).toBe("/flavours");
    expect(byPath("/fine-fragrances")).toBe("/fragrances/fine-fragrance");
    expect(byPath("/incense-and-bakhoor")).toBe("/fragrances/incense-and-bakhoor");
    expect(byPath("/savoury")).toBe("/flavours/savoury");
    expect(byPath("/about/our-company")).toBe("/about");
    expect(byPath("/about/sustainability")).toBe("/sustainability");
    expect(byPath("/about/certifications")).toBe("/sustainability/compliance");
    expect(byPath("/about/certification")).toBe("/sustainability/certifications");
    expect(byPath("/contactus")).toBe("/contact");
  });

  it("covers all eleven application pages", () => {
    const apps = redirectTable.filter((r) => /^\/fragrances\/|^\/flavours\//.test(r.destination));
    expect(apps).toHaveLength(11);
  });
});

describe("next.config redirects()", () => {
  it("serves exactly the table as single-hop 301 redirects", async () => {
    const out = await nextConfig.redirects?.();
    expect(out).toBeDefined();
    expect(out).toHaveLength(redirectRules.length);
    for (const [i, r] of (out ?? []).entries()) {
      expect(r.source).toBe(redirectRules[i]?.source);
      expect(r.destination).toBe(redirectRules[i]?.destination);
      expect(r).toHaveProperty("statusCode", 301);
      expect(r).not.toHaveProperty("permanent");
    }
  });
});
