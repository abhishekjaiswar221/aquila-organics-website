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
