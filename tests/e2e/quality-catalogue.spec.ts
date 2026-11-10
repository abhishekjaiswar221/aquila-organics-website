import { expect, test, type Page } from "@playwright/test";
import { APPLICATION_SLUGS } from "../../src/content/segments";
import { ARCHIVED, BULK, DRAFT, ETHANOL, MINIMAL, WATER } from "./support/fixtures";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";

/*
 * Quality gates for every page of the catalogue / RFQ / admin-login slice, at
 * each of the four width projects: no horizontal overflow, axe clean, one h1,
 * no skipped heading levels, and the robots meta each page must carry. The
 * page-specific specs (catalogue, rfq, admin) cover behaviour; this file is
 * the one place the per-page gates live for these pages.
 */

const ENQUIRY_KEY = "aquila.enquiry.v1";

type Robots = "noindex" | "indexable";

type PageCase = {
  name: string;
  url: string;
  status: number;
  robots: Robots;
  /** Waits for content that renders after hydration, before the checks run. */
  ready?: (page: Page) => Promise<void>;
  setup?: (page: Page) => Promise<unknown>;
};

const line = (page: Page, n: number) => page.getByRole("group", { name: new RegExp(`^Product ${n}\\b`) });

const PAGES: PageCase[] = [
  { name: "catalogue list", url: "/aroma-chemicals", status: 200, robots: "indexable" },
  {
    name: "catalogue: no results",
    url: "/aroma-chemicals?q=zzz-no-such-thing",
    status: 200,
    robots: "noindex",
  },
  {
    // Task 8 review gap: the past-the-end state had no axe run.
    name: "catalogue: page past the end",
    url: "/aroma-chemicals?page=99",
    status: 200,
    robots: "noindex",
    ready: async (page) => {
      await expect(page.getByRole("link", { name: /first page/i })).toBeVisible();
    },
  },
  { name: "product: full", url: `/aroma-chemicals/${ETHANOL.slug}`, status: 200, robots: "indexable" },
  { name: "product: minimal", url: `/aroma-chemicals/${MINIMAL.slug}`, status: 200, robots: "indexable" },
  {
    // Task 8 review gap: the 404 page had no axe run.
    name: "product 404 (draft slug)",
    url: `/aroma-chemicals/${DRAFT.slug}`,
    status: 404,
    robots: "noindex",
  },
  { name: "site 404", url: "/no-such-page-test", status: 404, robots: "noindex" },
  {
    name: "rfq with two saved products",
    url: "/rfq",
    status: 200,
    robots: "indexable",
    setup: (page) =>
      page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [ENQUIRY_KEY, JSON.stringify([ETHANOL.id, WATER.id])] as const,
      ),
    ready: async (page) => {
      await expect(line(page, 2)).toBeVisible();
    },
  },
  { name: "rfq confirmation", url: "/rfq/confirmation?ref=AQ-2026-000001", status: 200, robots: "noindex" },
  { name: "rfq confirmation without a reference", url: "/rfq/confirmation", status: 200, robots: "noindex" },
  { name: "privacy notice", url: "/privacy", status: 200, robots: "indexable" },
  { name: "admin login", url: "/admin/login", status: 200, robots: "noindex" },
];

async function expectRobots(page: Page, robots: Robots) {
  const metas = page.locator('meta[name="robots"]');
  if (robots === "noindex") {
    await expect(metas.first()).toHaveAttribute("content", /noindex/);
    return;
  }
  for (const content of await metas.evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? ""))) {
    expect(content).not.toMatch(/noindex/);
  }
}

test.describe("quality gates: catalogue, rfq, privacy, admin login", () => {
  for (const c of PAGES) {
    test(`${c.name}: overflow, axe, headings, robots`, async ({ page }) => {
      await c.setup?.(page);
      const res = await page.goto(c.url);
      expect(res?.status()).toBe(c.status);
      await c.ready?.(page);
      await expectRobots(page, c.robots);
      await expectNoOverflow(page);
      await expectHeadingOutline(page);
      await expectAxeClean(page);
    });
  }
});

test.describe("quality gates: robots.txt and sitemap.xml", () => {
  test("sitemap lists the static pages and published products, and nothing unpublished or private", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? "").pathname);
    // Exact set: every indexable static page, plus the published fixtures, and nothing else. The
    // certifications page is absent on purpose (noindex until a certificate is confirmed).
    const staticPaths = [
      "/",
      "/aroma-chemicals",
      "/privacy",
      "/fragrances",
      "/flavours",
      "/about",
      "/innovation",
      "/sustainability",
      "/sustainability/compliance",
      "/contact",
      ...APPLICATION_SLUGS.fragrances.map((s) => `/fragrances/${s}`),
      ...APPLICATION_SLUGS.flavours.map((s) => `/flavours/${s}`),
    ];
    const productPaths = [ETHANOL, WATER, MINIMAL, ...BULK].map((p) => `/aroma-chemicals/${p.slug}`);
    expect([...locs].sort()).toEqual([...staticPaths, ...productPaths].sort());
    expect(locs).not.toContain("/sustainability/certifications");
    expect(xml).not.toContain(DRAFT.slug);
    expect(xml).not.toContain(ARCHIVED.slug);
    for (const loc of locs) {
      expect(loc).not.toMatch(/^\/(admin|api)(\/|$)/);
      expect(loc).not.toMatch(/^\/rfq/);
    }
  });

  test("robots allows the site, disallows admin and api, and names the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toMatch(/Allow: \/\n/);
    expect(txt).toContain("Disallow: /admin");
    expect(txt).toContain("Disallow: /api");
    expect(txt).toMatch(/Sitemap: http.*\/sitemap\.xml/);
  });
});
