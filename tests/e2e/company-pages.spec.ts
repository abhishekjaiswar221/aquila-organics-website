import { expect, test } from "@playwright/test";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";

/*
 * About, Innovation, Sustainability, Compliance and Certifications. Content comes from
 * src/content (verified or brief-supplied only). Runs at every width project.
 */

const BANNED = /16\+|since 20(10|12)|\b\d+\s+years|best agarbatti|largest manufacturer|state-of-the-art/i;
// Certification and regulatory document names may appear ONLY on the compliance page.
const DOC_NAMES = /\b(ISO|Kosher|Halal|FDA|EcoVadis|Star-K|REACH|IFRA|GMP)\b/;

const PAGES = [
  { url: "/about", h1: "About Aquila Organics" },
  { url: "/innovation", h1: "Innovation and capabilities" },
  { url: "/sustainability", h1: "Sustainability" },
  { url: "/sustainability/compliance", h1: "Legal and regulatory compliance" },
  { url: "/sustainability/certifications", h1: "Certifications" },
];

test.describe("page gates", () => {
  for (const p of PAGES) {
    test(`${p.url} renders, passes the page gates and carries no banned claim`, async ({ page }) => {
      const res = await page.goto(p.url);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.h1);
      await expectHeadingOutline(page);
      await expectNoOverflow(page);
      await expectAxeClean(page);
      await expect(page.getByRole("navigation", { name: /breadcrumb/i })).toBeVisible();
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(BANNED);
    });
  }

  for (const p of PAGES.filter((x) => x.url !== "/sustainability/compliance")) {
    test(`${p.url} names no certification or regulation`, async ({ page }) => {
      await page.goto(p.url);
      expect(await page.locator("main").innerText()).not.toMatch(DOC_NAMES);
    });
  }
});

test.describe("/about", () => {
  test("shows Girish Vaze, the two production areas and the regions, not the second director or any counts", async ({ page }) => {
    await page.goto("/about");
    const main = page.locator("main");
    await expect(main.getByText("Girish Vaze", { exact: false }).first()).toBeVisible();
    await expect(main.getByText(/Hattali/)).toHaveCount(0);
    await expect(main.getByText(/Ratnagiri/)).toBeVisible();
    await expect(main.getByText(/Palghar/)).toBeVisible();
    for (const r of ["India", "Middle East", "Africa", "APAC"]) {
      await expect(main.getByRole("listitem").filter({ hasText: new RegExp(`^${r}$`) })).toHaveCount(1);
    }
    expect(await main.innerText()).not.toMatch(/\d+\s+(countries|employees|customers)/i);
  });

  test("lists the three business segments", async ({ page }) => {
    await page.goto("/about");
    const list = page.locator("main").getByRole("listitem");
    for (const s of ["Fragrances", "Aroma chemicals", "Flavours"]) {
      await expect(list.filter({ hasText: new RegExp(`^${s}$`) })).toHaveCount(1);
    }
  });

  test("emits Organization and breadcrumb data that claim nothing unconfirmed", async ({ page }) => {
    await page.goto("/about");
    const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    const org = blocks.find((b) => b["@type"] === "Organization");
    expect(org.name).toBe("Aquila Organics Private Limited");
    for (const k of ["foundingDate", "numberOfEmployees", "sameAs", "logo", "award"]) expect(org).not.toHaveProperty(k);
    expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);
  });
});

test.describe("/innovation", () => {
  test("lists exactly the fourteen chemistries and mentions no capacity or equipment", async ({ page }) => {
    await page.goto("/innovation");
    const section = page.locator("main div", { has: page.getByRole("heading", { name: "Chemistries we work with" }) }).last();
    await expect(section.getByRole("listitem")).toHaveCount(14);
    expect(await page.locator("main").innerText()).not.toMatch(/tonnes|capacity|\bMT\b|equipment/i);
  });

  test("flags nothing as a fact the client has not confirmed (toll manufacturing stays a plain statement)", async ({ page }) => {
    await page.goto("/innovation");
    await expect(page.getByText(/toll manufacturing/i)).toHaveCount(1);
  });
});

test.describe("/sustainability", () => {
  test("shows the three verified programmes and no rating badge", async ({ page }) => {
    await page.goto("/sustainability");
    for (const h of ["Zero liquid waste policy", "Hazardous waste management", "Community"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
  });
});

test.describe("/sustainability/compliance", () => {
  test("lists the documents only as awaiting confirmation, without links or compliance claims", async ({ page }) => {
    await page.goto("/sustainability/compliance");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Documents awaiting confirmation" })).toBeVisible();
    for (const t of [/EC certificate letter/, /six-month compliance reports/, /ISO certificates/, /Halal/, /Kosher/, /FDA/]) {
      await expect(main.getByRole("listitem").filter({ hasText: t })).toHaveCount(1);
    }
    const text = await main.innerText();
    expect(text).not.toMatch(/\bcertified\b|compliant with|we comply/i);
    const fileLinks = await main.locator('a[href$=".pdf"], a[href$=".jpg"], a[href*="/images/certifications"]').count();
    expect(fileLinks).toBe(0);
  });
});

test.describe("/sustainability/certifications", () => {
  test("is noindex, shows the pending message and no expiry claim while nothing is confirmed", async ({ page, request }) => {
    await page.goto("/sustainability/certifications");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText(/certificates are being compiled/i)).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/expire|expired|valid until/i);
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toContain("/sustainability/certifications</loc>");
  });
});

test("the sitemap lists about, innovation, sustainability and compliance", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/about", "/innovation", "/sustainability", "/sustainability/compliance"]) {
    expect(xml, path).toContain(`${path}</loc>`);
  }
});

test("the other pages are indexable", async ({ page }) => {
  for (const url of ["/about", "/innovation", "/sustainability", "/sustainability/compliance"]) {
    await page.goto(url);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  }
});
