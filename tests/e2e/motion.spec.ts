import { expect, test } from "@playwright/test";

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("every reveal wrapper is fully visible immediately", async ({ page }) => {
    await page.goto("/");
    const count = await page.locator("[data-reveal]").count();
    expect(count).toBeGreaterThan(3);
    const opacities = await page.$$eval("[data-reveal]", (els) =>
      els.map((e) => Number(getComputedStyle(e).opacity)),
    );
    expect(opacities.every((o) => o === 1)).toBe(true);
  });
});

test.describe("no javascript", () => {
  test.use({ javaScriptEnabled: false });

  test("all section text is present and visible", async ({ page }) => {
    await page.goto("/");
    for (const id of ["aroma-chemicals", "flavours", "manufacturing", "leadership", "sustainability", "enquire"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    const opacities = await page.$$eval("[data-reveal]", (els) =>
      els.map((e) => Number(getComputedStyle(e).opacity)),
    );
    expect(opacities.every((o) => o === 1)).toBe(true);
  });
});

test.describe("normal motion", () => {
  test("below-the-fold reveals end fully visible after scrolling", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const opacities = await page.$$eval("[data-reveal]", (els) =>
      els.map((e) => Number(getComputedStyle(e).opacity)),
    );
    expect(opacities.every((o) => o === 1)).toBe(true);
  });
});
