import { expect, test } from "@playwright/test";

test.describe("navigation", () => {
  test("skip link is first tab stop and moves focus to main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("segment menu toggles, closes on Escape and restores focus", async ({ page }, info) => {
    test.skip(info.project.use.viewport!.width < 1024, "desktop only");
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /what we make/i });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /^Aroma Chemicals/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("mobile drawer opens, closes on Escape", async ({ page }, info) => {
    test.skip(info.project.use.viewport!.width >= 1024, "mobile/tablet only");
    await page.goto("/");
    const open = page.getByRole("button", { name: /open menu/i });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("footer shows both labelled offices and tel/mailto links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByText("Registered office")).toBeVisible();
    await expect(footer.getByText("Head office")).toBeVisible();
    await expect(footer.getByText(/Thane/)).toBeVisible();
    await expect(footer.getByText(/Rabale/)).toBeVisible();
    await expect(footer.locator('a[href^="mailto:"]').first()).toBeVisible();
    await expect(footer.locator('a[href^="tel:"]').first()).toBeVisible();
  });

  test("no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
