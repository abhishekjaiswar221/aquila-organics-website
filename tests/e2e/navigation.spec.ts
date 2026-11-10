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

test.describe("navigation links to the business pages", () => {
  const FRAGRANCE_HREFS = [
    "/fragrances/fine-fragrance",
    "/fragrances/personal-care",
    "/fragrances/air-care",
    "/fragrances/fabric-care",
    "/fragrances/home-care",
    "/fragrances/incense-and-bakhoor",
  ];

  test("desktop: the segment menu links to the segment and application pages", async ({ page }, info) => {
    test.skip(info.project.use.viewport!.width < 1024, "desktop only");
    await page.goto("/");
    await page.getByRole("button", { name: /what we make/i }).click();
    const menu = page.locator("#segment-menu");
    for (const href of ["/fragrances", "/aroma-chemicals", "/flavours", ...FRAGRANCE_HREFS, "/flavours/bakery", "/innovation", "/rfq"]) {
      await expect(menu.locator(`a[href="${href}"]`).first(), href).toBeVisible();
    }
  });

  test("desktop: header links About and Sustainability and sends the call to action to /contact", async ({ page }, info) => {
    test.skip(info.project.use.viewport!.width < 1024, "desktop only");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    await expect(nav.getByRole("link", { name: "Sustainability" })).toHaveAttribute("href", "/sustainability");
    await expect(nav.getByRole("link", { name: /request a consultation/i })).toHaveAttribute("href", "/contact");
  });

  test("a menu link navigates to its page and closes the menu", async ({ page }, info) => {
    test.skip(info.project.use.viewport!.width < 1024, "desktop only");
    await page.goto("/");
    await page.getByRole("button", { name: /what we make/i }).click();
    await page.locator("#segment-menu").getByRole("link", { name: "Air Care" }).click();
    await expect(page).toHaveURL(/\/fragrances\/air-care$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Air Care");
  });

  test("mobile: the drawer links to the application pages, the company pages and the contact page", async ({ page }, info) => {
    test.skip(info.project.use.viewport!.width >= 1024, "mobile/tablet only");
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    const dialog = page.getByRole("dialog");
    for (const href of [...FRAGRANCE_HREFS, "/flavours/dairy", "/about", "/innovation", "/sustainability", "/contact", "/rfq"]) {
      await expect(dialog.locator(`a[href="${href}"]`).first(), href).toBeVisible();
    }
    await dialog.getByRole("link", { name: "Bakery" }).click();
    await expect(page).toHaveURL(/\/flavours\/bakery$/);
  });

  test("every internal link in the header, drawer and footer resolves, and none is a bare anchor or an old URL", async ({ page, request }) => {
    const { redirectRules } = await import("../../src/content/redirects");
    const old = new Set(redirectRules.map((r) => r.source));
    await page.goto("/");
    const hrefs = await page
      .locator("header a[href], dialog a[href], footer a[href]")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    const internal = [...new Set(hrefs.filter((h) => h.startsWith("/")))];
    expect(internal.length).toBeGreaterThan(15);
    for (const h of hrefs) {
      expect(h, "bare anchor").not.toBe("#");
      expect(h).not.toMatch(/^#/);
    }
    for (const h of internal) {
      expect(old.has(h), `${h} is an old URL`).toBe(false);
      const res = await request.get(h);
      expect(res.status(), h).toBeLessThan(400);
    }
  });

  test("the footer links About, Sustainability, Contact, the quotation request and privacy", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("navigation", { name: "Footer" });
    for (const [name, href] of [
      ["About", "/about"],
      ["Sustainability", "/sustainability"],
      ["Contact", "/contact"],
      ["Request a quotation", "/rfq"],
      ["Privacy", "/privacy"],
    ] as const) {
      await expect(footer.getByRole("link", { name }), name).toHaveAttribute("href", href);
    }
  });
});
