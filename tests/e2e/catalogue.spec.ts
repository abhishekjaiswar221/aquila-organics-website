import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ARCHIVED, BULK, DRAFT, ETHANOL, MINIMAL, PUBLISHED_COUNT, SOURCE_NOTE, WATER } from "./support/fixtures";

const LIST = "/aroma-chemicals";
const ENQUIRY_KEY = "aquila.enquiry.v1";

const rows = (page: Page) => page.getByRole("list", { name: "Products" }).getByRole("listitem");

async function search(page: Page, q: string) {
  await page.getByLabel("Search the catalogue").fill(q);
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/[?&]q=/);
}

test.describe("catalogue list", () => {
  test("shows published products with name, code, CAS and category", async ({ page }) => {
    await page.goto(LIST);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/aroma chemicals/i);
    await expect(page.getByText(`${PUBLISHED_COUNT} products`)).toBeVisible();
    const eth = rows(page).filter({ hasText: ETHANOL.name });
    await expect(eth).toHaveCount(1);
    await expect(eth).toContainText(ETHANOL.code);
    await expect(eth).toContainText(ETHANOL.cas);
    await expect(eth).toContainText("TEST-Solvents");
    await expect(eth.getByRole("link", { name: ETHANOL.name })).toHaveAttribute("href", `${LIST}/${ETHANOL.slug}`);
  });

  test("never lists draft or archived products", async ({ page }) => {
    for (const url of [LIST, `${LIST}?page=2`]) {
      await page.goto(url);
      await expect(page.locator("main")).not.toContainText(DRAFT.name);
      await expect(page.locator("main")).not.toContainText(ARCHIVED.name);
    }
  });

  test("searches by CAS number with and without hyphens", async ({ page }) => {
    for (const q of [ETHANOL.cas, ETHANOL.cas.replace(/-/g, "")]) {
      await page.goto(LIST);
      await search(page, q);
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(ETHANOL.name);
      await expect(page.getByLabel("Search the catalogue")).toHaveValue(q);
    }
  });

  test("searches by name and by product code", async ({ page }) => {
    await page.goto(`${LIST}?q=${encodeURIComponent("test-wat")}`);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(WATER.name);
    await page.goto(`${LIST}?q=${encodeURIComponent(ETHANOL.code)}`);
    await expect(rows(page)).toHaveCount(1);
  });

  test("draft and archived products are absent from search", async ({ page }) => {
    for (const q of [DRAFT.cas, DRAFT.name, ARCHIVED.cas, ARCHIVED.code]) {
      await page.goto(`${LIST}?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole("heading", { name: /no products match/i })).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
    }
  });

  test("a query that matches nothing says so and offers to clear filters", async ({ page }) => {
    await page.goto(`${LIST}?q=zzz-no-such-product`);
    await expect(page.getByRole("heading", { name: /no products match/i })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL(new RegExp(`${LIST}$`));
    await expect(rows(page)).toHaveCount(24);
  });

  test("filters by category", async ({ page }) => {
    await page.goto(LIST);
    await page.getByLabel("Category").selectOption("test-solvents");
    await page.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/category=test-solvents/);
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator("main")).not.toContainText(BULK[0].name);
  });

  test("paginates 24 per page and Clear filters resets to the bare route", async ({ page }) => {
    await page.goto(LIST);
    await expect(rows(page)).toHaveCount(24);
    const pager = page.getByRole("navigation", { name: "Pagination" });
    await pager.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows(page)).toHaveCount(PUBLISHED_COUNT - 24);
    await expect(pager.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(new RegExp(`${LIST}$`));
    await expect(rows(page)).toHaveCount(24);
  });

  test("sorts by name descending", async ({ page }) => {
    await page.goto(`${LIST}?sort=name-desc`);
    await expect(rows(page).first()).toContainText(WATER.name);
    await expect(page.getByLabel("Sort by")).toHaveValue("name-desc");
  });

  test("a page past the end offers the first page", async ({ page }) => {
    await page.goto(`${LIST}?page=99`);
    await expect(page.getByRole("link", { name: /first page/i })).toHaveAttribute("href", LIST);
  });

  test("list metadata: bare list indexable, variants noindex with a bare canonical", async ({ page }) => {
    await page.goto(LIST);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/aroma-chemicals$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await page.goto(`${LIST}?q=ethanol&page=2`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/aroma-chemicals$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  });

  // Overflow, axe and heading gates for the list states: quality-catalogue.spec.ts.
});

test.describe("catalogue without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("search form and pagination work as plain GET", async ({ page }) => {
    await page.goto(LIST);
    await page.getByLabel("Search the catalogue").fill(ETHANOL.cas);
    await page.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/q=64-17-5/);
    await expect(rows(page)).toHaveCount(1);
    await page.goto(`${LIST}?page=2`);
    await expect(rows(page)).toHaveCount(PUBLISHED_COUNT - 24);
  });

  test("product page content is visible", async ({ page }) => {
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ETHANOL.name);
    await expect(page.getByRole("table", { name: "Specifications" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a quote" })).toBeVisible();
  });
});

test.describe("product detail", () => {
  test("renders every field the full product has", async ({ page }) => {
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ETHANOL.name);
    const main = page.locator("main");
    await expect(main.getByText(ETHANOL.code, { exact: true })).toBeVisible();
    await expect(main.getByText(ETHANOL.cas, { exact: true })).toBeVisible();
    await expect(main.getByText(ETHANOL.description)).toBeVisible();
    const specs = page.getByRole("table", { name: "Specifications" });
    for (const s of ETHANOL.specifications) {
      await expect(specs.getByRole("row", { name: `${s.label} ${s.value}` })).toBeVisible();
    }
    for (const a of ETHANOL.applications) await expect(main.getByText(a)).toBeVisible();
    await expect(main.getByRole("link", { name: new RegExp(ETHANOL.document.title) })).toHaveAttribute(
      "href",
      `${LIST}/documents/${ETHANOL.document.id}`,
    );
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Aroma chemicals" })).toHaveAttribute("href", LIST);
    await expect(crumbs.getByRole("link", { name: "TEST-Solvents" })).toBeVisible();
    // Related products: same category, published only.
    const related = page.getByRole("region", { name: "Related products" });
    await expect(related.getByRole("link", { name: WATER.name })).toBeVisible();
    await expect(related).not.toContainText(DRAFT.name);
    await expect(main.getByRole("link", { name: "Request a quote" })).toHaveAttribute(
      "href",
      /^mailto:sales@aquilaorganics\.com\?subject=.*TEST-Ethanol.*64-17-5/,
    );
  });

  test("renders only the fields a minimal product has", async ({ page }) => {
    await page.goto(`${LIST}/${MINIMAL.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(MINIMAL.name);
    for (const name of ["Description", "Specifications", "Applications", "Documents", "Related products"]) {
      await expect(page.getByRole("heading", { name })).toHaveCount(0);
    }
    await expect(page.locator("main")).not.toContainText(/CAS number|Product code/i);
    await expect(page.getByRole("button", { name: /add to enquiry/i })).toBeVisible();
  });

  test("JSON-LD describes only existing fields and never offers or prices", async ({ page }) => {
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = blocks.map((b) => JSON.parse(b) as Record<string, unknown>);
    const product = parsed.find((p) => p["@type"] === "Product");
    const crumbs = parsed.find((p) => p["@type"] === "BreadcrumbList");
    expect(product).toMatchObject({ name: ETHANOL.name, sku: ETHANOL.code, description: ETHANOL.description });
    expect(crumbs).toBeTruthy();
    expect(blocks.join(" ")).not.toMatch(/offers|price|brand/i);

    await page.goto(`${LIST}/${MINIMAL.slug}`);
    const minimal = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((b) => JSON.parse(b) as Record<string, unknown>)
      .find((p) => p["@type"] === "Product");
    expect(Object.keys(minimal ?? {}).sort()).toEqual(["@context", "@type", "name", "url"]);
  });

  test("detail metadata: canonical and indexable", async ({ page }) => {
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    await expect(page).toHaveTitle(/TEST-Ethanol/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/aroma-chemicals/${ETHANOL.slug}$`));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  });

  test("never exposes storage keys", async ({ page }) => {
    const res = await page.goto(`${LIST}/${ETHANOL.slug}`);
    const html = (await res?.text()) ?? "";
    expect(html).not.toContain(ETHANOL.document.storageKey);
    expect(html).not.toContain(SOURCE_NOTE); // internal provenance note
  });

  test("draft and archived slugs return the 404 page", async ({ page }) => {
    for (const slug of [DRAFT.slug, ARCHIVED.slug, "no-such-product"]) {
      const res = await page.goto(`${LIST}/${slug}`);
      expect(res?.status(), slug).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/not found/i);
      await expect(page.locator("main")).not.toContainText(DRAFT.name);
    }
  });

  // Overflow, axe and heading gates for product and 404 pages: quality-catalogue.spec.ts.
});

test.describe("add to enquiry", () => {
  test("persists in localStorage across a reload", async ({ page }) => {
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    await page.getByRole("button", { name: /add to enquiry/i }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added to your enquiry list" })).toBeVisible();
    const stored = await page.evaluate((k) => window.localStorage.getItem(k), ENQUIRY_KEY);
    expect(JSON.parse(stored ?? "[]")).toEqual([ETHANOL.id]);
    await page.reload();
    await expect(page.getByText("Added to your enquiry list")).toBeVisible();
    await expect(page.getByRole("button", { name: /add to enquiry/i })).toHaveCount(0);
  });

  test("works without an error when storage is blocked", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    await page.getByRole("button", { name: /add to enquiry/i }).click();
    await expect(page.getByText("Added to your enquiry list")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("documents", () => {
  test("downloads a published product's document as an attachment", async ({ request }) => {
    const res = await request.get(`${LIST}/documents/${ETHANOL.document.id}`);
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers["content-type"]).toBe("application/pdf");
    expect(headers["content-disposition"]).toMatch(/^attachment; filename="TEST-Ethanol datasheet\.pdf"/);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(JSON.stringify(headers)).not.toContain(ETHANOL.document.storageKey);
    expect(await res.text()).toBe(ETHANOL.document.body);
  });

  test("a draft product's document and unknown ids are 404", async ({ request }) => {
    for (const id of [DRAFT.document.id, "e2e00000-0000-4000-8000-00000000ffff", "not-a-uuid"]) {
      const res = await request.get(`${LIST}/documents/${id}`);
      expect(res.status(), id).toBe(404);
      expect(await res.text()).not.toContain(DRAFT.document.body);
    }
  });
});

// robots.txt and sitemap.xml: quality-catalogue.spec.ts.

test.describe("entry points", () => {
  test("homepage CTAs link to the catalogue", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Explore aroma chemicals" })).toHaveAttribute("href", LIST);
    await expect(page.locator("#segments").getByRole("link", { name: /Aroma Chemicals/ })).toHaveAttribute("href", LIST);
  });
});

test.describe("review screenshots", () => {
  test("capture list and detail", async ({ page }, info) => {
    const width = info.project.use.viewport!.width;
    test.skip(width !== 375 && width !== 1280, "375 and 1280 only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const dir = path.resolve(__dirname, "../../docs/screenshots");
    fs.mkdirSync(dir, { recursive: true });
    await page.goto(LIST);
    await page.screenshot({ path: path.join(dir, `catalogue-list-${width}.png`), fullPage: true });
    await page.goto(`${LIST}/${ETHANOL.slug}`);
    await page.screenshot({ path: path.join(dir, `catalogue-detail-${width}.png`), fullPage: true });
  });
});
