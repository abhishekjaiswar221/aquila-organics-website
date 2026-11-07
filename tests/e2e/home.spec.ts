import { expect, test } from "@playwright/test";

const BANNED = /16\+|since 20(10|12)|\b\d+\s+years|best agarbatti|largest manufacturer/i;

test.describe("homepage: hero to fragrance applications", () => {
  test("has exactly one h1 with the tagline", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText("Where Science Meets Senses.");
  });

  test("shows the three business segments", async ({ page }) => {
    await page.goto("/");
    const seg = page.locator("#segments");
    for (const name of ["Fragrances", "Aroma Chemicals", "Flavours"]) {
      await expect(seg.getByRole("heading", { name })).toBeVisible();
    }
  });

  test("lists all six fragrance applications by name", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#fragrances");
    for (const name of [
      "Fine Fragrance",
      "Personal Care",
      "Air Care",
      "Fabric Care",
      "Home Care",
      "Incense and Bakhoor",
    ]) {
      await expect(section.getByRole("heading", { name })).toBeVisible();
    }
    await expect(section.getByText(/Oudhs, Bakhoors and Arabic fragrance notes/)).toBeVisible();
  });

  test("contains no unconfirmed claims and no dead links", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(BANNED);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });
});

test.describe("homepage: chemicals to enquiry", () => {
  test("renders every remaining section in order", async ({ page }) => {
    await page.goto("/");
    const ids = ["aroma-chemicals", "flavours", "manufacturing", "strengths", "leadership", "sustainability", "global-reach", "enquire"];
    const tops: number[] = [];
    for (const id of ids) {
      const el = page.locator(`#${id}`);
      await expect(el, id).toHaveCount(1);
      tops.push(await el.evaluate((n) => n.getBoundingClientRect().top + window.scrollY));
    }
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  });

  test("lists exactly 14 chemistries", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#aroma-chemicals [data-chemistry]")).toHaveCount(14);
  });

  test("leadership shows Girish Vaze and not the unconfirmed director", async ({ page }) => {
    await page.goto("/");
    const lead = page.locator("#leadership");
    await expect(lead.getByText("Girish Vaze").first()).toBeVisible();
    await expect(page.getByText(/Hattali/)).toHaveCount(0);
  });

  test("hides certifications and badges until confirmed", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("main").innerText();
    for (const banned of [/ecovadis/i, /kosher/i, /halal/i, /\bFDA\b/, /Star-K/i, /ISO\s?\d/]) {
      expect(text).not.toMatch(banned);
    }
    await expect(page.getByRole("heading", { name: /certification/i })).toHaveCount(0);
  });

  test("manufacturing names the two production areas only", async ({ page }) => {
    await page.goto("/");
    const m = page.locator("#manufacturing");
    await expect(m.getByText(/Ratnagiri/)).toBeVisible();
    await expect(m.getByText(/Palghar/)).toBeVisible();
    await expect(m).not.toContainText(/capacity|tonnes|tons|\bMT\b/i);
  });

  test("global reach lists regions without counts", async ({ page }) => {
    await page.goto("/");
    const g = page.locator("#global-reach");
    for (const r of ["India", "Middle East", "Africa", "APAC"]) await expect(g.getByText(r, { exact: true })).toBeVisible();
    await expect(g).not.toContainText(/\d+\s+countries/i);
  });
});
