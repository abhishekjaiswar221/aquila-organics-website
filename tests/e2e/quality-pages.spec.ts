import { expect, test } from "@playwright/test";
import { redirectRules } from "../../src/content/redirects";
import { APPLICATION_SLUGS } from "../../src/content/segments";

/*
 * Cross-page SEO and content gates for the business pages. Per-page behaviour, accessibility and
 * overflow checks live in segments.spec, company-pages.spec and contact.spec at every width; these
 * checks do not depend on the viewport, so they run once.
 */
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "w1280", "viewport independent");
});

const PAGES = [
  "/fragrances",
  ...APPLICATION_SLUGS.fragrances.map((s) => `/fragrances/${s}`),
  "/flavours",
  ...APPLICATION_SLUGS.flavours.map((s) => `/flavours/${s}`),
  "/about",
  "/innovation",
  "/sustainability",
  "/sustainability/compliance",
  "/sustainability/certifications",
  "/contact",
];

const NOINDEX = new Set(["/sustainability/certifications"]);
const DOC_NAMES = /\b(ISO|Kosher|Halal|FDA|EcoVadis|Star-K|REACH|IFRA|GMP)\b/;
const HIDDEN_PEOPLE = /Shalin Kale|Sunil Patil|Hattali/;
const BANNED = /16\+|since 20(10|12)|\b\d+\s+years|best agarbatti|largest manufacturer|state-of-the-art|\bcertified\b/i;
const OLD_URLS = new Set(redirectRules.map((r) => r.source));

type Seen = { title: string; description: string; h1: string };

test.describe.configure({ mode: "serial" });

test.describe("every business page", () => {
  const seen = new Map<string, Seen>();

  for (const path of PAGES) {
    test(`${path}: canonical, title, description, structured data, robots, links and content rules`, async ({ page, request }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);

      // Canonical is absolute and points at this page.
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical, "canonical").toMatch(/^https?:\/\//);
      expect(new URL(canonical ?? "").pathname).toBe(path);

      const title = await page.title();
      const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
      const h1 = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
      expect(title.length, "title").toBeGreaterThan(3);
      expect(description.length, "description").toBeGreaterThan(20);
      seen.set(path, { title, description, h1 });

      // Robots: indexable except the certifications page while nothing is confirmed.
      const robots = (await page.locator('meta[name="robots"]').getAttribute("content")) ?? "";
      expect(robots).toMatch(NOINDEX.has(path) ? /noindex/ : /^index/);

      // Structured data parses, has a breadcrumb that ends at this page, and no review/offer claims.
      const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
      const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
      expect(crumbs, "BreadcrumbList").toBeDefined();
      const last = crumbs.itemListElement.at(-1);
      expect(new URL(last.item).pathname).toBe(path);
      expect(JSON.stringify(blocks)).not.toMatch(/"(offers|aggregateRating|review|price)"/);

      // Content rules.
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(HIDDEN_PEOPLE);
      if (path !== "/sustainability/compliance") expect(text).not.toMatch(DOC_NAMES);

      // Internal links resolve and none points at an old URL that now redirects.
      const hrefs = await page.locator("main a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      for (const h of new Set(hrefs.filter((x) => x.startsWith("/")))) {
        const clean = h.split("?")[0] ?? h;
        expect(OLD_URLS.has(clean), `${path} links to old URL ${h}`).toBe(false);
        const r = await request.get(h);
        expect(r.status(), `${path} -> ${h}`).toBeLessThan(400);
      }
    });
  }

  test("titles, descriptions and headings are unique across the pages", () => {
    expect(seen.size, "pages visited before this check").toBe(PAGES.length);
    for (const key of ["title", "description", "h1"] as const) {
      const values = [...seen.values()].map((s) => s[key]);
      const dupes = values.filter((v, i) => values.indexOf(v) !== i);
      expect(dupes, `duplicate ${key}`).toEqual([]);
    }
  });
});

test.describe("sitemap and robots", () => {
  test("the sitemap lists every indexable business page and not the noindex ones", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const path of PAGES.filter((p) => !NOINDEX.has(p))) expect(xml, path).toContain(`${path}</loc>`);
    for (const path of NOINDEX) expect(xml, path).not.toContain(`${path}</loc>`);
    for (const path of ["/rfq/confirmation", "/contact/confirmation"]) expect(xml, path).not.toContain(path);
  });

  test("robots.txt is unchanged: allow the site, disallow admin and api, name the sitemap", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt).toMatch(/Allow: \/\n/);
    expect(txt).toContain("Disallow: /admin");
    expect(txt).toContain("Disallow: /api");
    expect(txt).toMatch(/Sitemap: http.*\/sitemap\.xml/);
  });
});

test.describe("confirmation pages", () => {
  for (const base of ["/rfq/confirmation", "/contact/confirmation"]) {
    test(`${base} is noindex`, async ({ page }) => {
      await page.goto(`${base}?ref=AQ-2026-000001`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }
});

test.describe("forms never put personal details in a URL", () => {
  for (const [path, selector] of [
    ["/contact", "form"],
    ["/rfq", "form"],
  ] as const) {
    test(`${path}: every form posts instead of using the default GET`, async ({ page }) => {
      await page.goto(path);
      const methods = await page.locator(selector).evaluateAll((forms) => forms.map((f) => (f as HTMLFormElement).getAttribute("method")));
      expect(methods.length).toBeGreaterThan(0);
      for (const m of methods) expect(m?.toLowerCase()).toBe("post");
    });
  }
});
