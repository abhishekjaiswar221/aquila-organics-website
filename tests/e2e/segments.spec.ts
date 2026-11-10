import { expect, test } from "@playwright/test";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";

/*
 * Fragrances and Flavours pages: the two overviews and the eleven application pages. Runs at each
 * width project. Content comes from src/content (verified or brief-supplied only).
 */

const BANNED = /16\+|since 20(10|12)|\b\d+\s+years|best agarbatti|largest manufacturer|state-of-the-art/i;

const FRAGRANCES = [
  ["fine-fragrance", "Fine Fragrance"],
  ["personal-care", "Personal Care"],
  ["air-care", "Air Care"],
  ["fabric-care", "Fabric Care"],
  ["home-care", "Home Care"],
  ["incense-and-bakhoor", "Incense and Bakhoor"],
] as const;

const FLAVOURS = [
  ["confectionery", "Confectionery"],
  ["bakery", "Bakery"],
  ["beverages", "Beverages"],
  ["dairy", "Dairy"],
  ["savoury", "Savoury"],
] as const;

const OVERVIEWS = [
  { url: "/fragrances", h1: "Fragrances", count: 6 },
  { url: "/flavours", h1: "Flavours", count: 5 },
];

const APPLICATION_PAGES = [
  ...FRAGRANCES.map(([slug, name]) => ({ url: `/fragrances/${slug}`, name, slug, type: "FRAGRANCES" })),
  ...FLAVOURS.map(([slug, name]) => ({ url: `/flavours/${slug}`, name, slug, type: "FLAVOURS" })),
];

test.describe("overview pages", () => {
  for (const o of OVERVIEWS) {
    test(`${o.url} renders with one h1 and a tile per application`, async ({ page }) => {
      const res = await page.goto(o.url);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(o.h1);
      await expectHeadingOutline(page);
      await expectNoOverflow(page);
      await expectAxeClean(page);
      const tiles = page.locator("main section[aria-labelledby='applications-title'] ul > li a");
      await expect(tiles).toHaveCount(o.count);
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(BANNED);
    });
  }

  test("the flavours overview shows the shisha and mouth-fresheners line", async ({ page }) => {
    await page.goto("/flavours");
    await expect(page.getByText(/shisha and mouth fresheners/i)).toBeVisible();
  });

  test("the overview tiles link to existing application pages", async ({ page }) => {
    await page.goto("/fragrances");
    const hrefs = await page
      .locator("main section[aria-labelledby='applications-title'] ul > li a")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(FRAGRANCES.map(([slug]) => `/fragrances/${slug}`));
  });
});

test.describe("application pages", () => {
  for (const p of APPLICATION_PAGES) {
    test(`${p.url} renders its name, consultation link and passes the page gates`, async ({ page }) => {
      const res = await page.goto(p.url);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.name);
      await expect(page.locator("main").getByRole("link", { name: /request a consultation/i })).toHaveAttribute(
        "href",
        `/contact?type=${p.type}&application=${p.slug}`,
      );
      await expect(page.getByRole("navigation", { name: /breadcrumb/i })).toBeVisible();
      await expectHeadingOutline(page);
      await expectNoOverflow(page);
      await expectAxeClean(page);
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(BANNED);
    });
  }

  test("incense and bakhoor shows the five sub-types and the Oud/Bakhoor/Arabic statement", async ({ page }) => {
    await page.goto("/fragrances/incense-and-bakhoor");
    for (const t of ["Bakhoor", "Flora Batti", "Incense Cone", "Masala Batti", "Scented Batti"]) {
      await expect(page.getByRole("listitem").filter({ hasText: new RegExp(`^${t}$`) })).toHaveCount(1);
    }
    await expect(page.getByText(/Oudhs, Bakhoors and Arabic fragrance notes/)).toBeVisible();
  });

  test("other application pages do not carry the Oud statement", async ({ page }) => {
    await page.goto("/fragrances/air-care");
    await expect(page.getByText(/Oudhs, Bakhoors and Arabic fragrance notes/)).toHaveCount(0);
  });

  test("each page has a canonical URL and breadcrumb data", async ({ page }) => {
    await page.goto("/fragrances/air-care");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fragrances\/air-care$/);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const crumbs = ld.map((t) => JSON.parse(t)).find((j) => j["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Home", "Fragrances", "Air Care"]);
  });
});

test.describe("unknown application slugs", () => {
  const BAD = [
    "/fragrances/nope",
    "/fragrances/Fine-Fragrance",
    "/fragrances/bakery",
    "/flavours/air-care",
    "/flavours/FINE",
    "/fragrances/%00",
    "/flavours/bakery%20",
  ]; // "/fragrances/%2e%2e" is omitted: dot segments normalise to "/" (the homepage, 200) before routing.
  for (const url of BAD) {
    test(`${url} answers a real 404`, async ({ request }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(404);
    });
  }

  test("a known slug with a trailing slash still resolves", async ({ request }) => {
    const res = await request.get("/fragrances/air-care/", { maxRedirects: 5 });
    expect(res.status()).toBe(200);
  });
});

test("the sitemap lists the two overviews and all eleven application pages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of [
    "/fragrances",
    "/flavours",
    ...APPLICATION_PAGES.map((p) => p.url),
  ]) {
    expect(xml, path).toContain(`${path}</loc>`);
  }
});
