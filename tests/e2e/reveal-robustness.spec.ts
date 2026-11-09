import { expect, test } from "@playwright/test";

const opacities = (page: import("@playwright/test").Page) =>
  page.$$eval("[data-reveal]", (els) =>
    els.map((e) => ({
      id: (e.firstElementChild as HTMLElement | null)?.id || "intro",
      opacity: Number(getComputedStyle(e).opacity),
    })),
  );

test.describe("reveal never strands content", () => {
  test("print output is fully opaque without any scrolling", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1200); // allow hydration
    await page.emulateMedia({ media: "print" });
    const o = await opacities(page);
    expect(o.length).toBeGreaterThan(3);
    expect(o.filter((x) => x.opacity !== 1)).toEqual([]);
  });

  test("an instant jump to the bottom leaves no section hidden", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1500);
    const o = await opacities(page);
    expect(o.filter((x) => x.opacity !== 1)).toEqual([]);
  });

  test("navigating to an anchor leaves nothing above the viewport hidden", async ({ page }) => {
    await page.goto("/#flavours");
    await page.waitForTimeout(1800);
    await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
    const hiddenAbove = await page.$$eval("[data-reveal]", (els) =>
      els
        .filter((e) => e.getBoundingClientRect().bottom <= 0 && Number(getComputedStyle(e).opacity) !== 1)
        .map((e) => (e.firstElementChild as HTMLElement | null)?.id ?? "?"),
    );
    expect(hiddenAbove).toEqual([]);
  });
});
