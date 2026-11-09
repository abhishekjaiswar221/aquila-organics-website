import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("quality gates", () => {
  test("no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("axe finds no violations", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });

  test("heading levels never skip downwards", async ({ page }) => {
    await page.goto("/");
    const levels = await page.$$eval("h1,h2,h3,h4,h5,h6", (hs) => hs.map((h) => Number(h.tagName[1])));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1], `heading #${i}`).toBeLessThanOrEqual(1);
    }
  });

  test("images have alt text or are decorative", async ({ page }) => {
    await page.goto("/");
    const bad = await page.$$eval("img", (imgs) =>
      imgs.filter((i) => i.getAttribute("alt") === null).length,
    );
    expect(bad).toBe(0);
  });

  test("long unbroken strings wrap instead of overflowing", async ({ page }) => {
    await page.goto("/");
    const wrap = await page.evaluate(() => getComputedStyle(document.body).overflowWrap);
    expect(["break-word", "anywhere"]).toContain(wrap);
  });

  test("capture review screenshot", async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(600);
    const dir = path.resolve(__dirname, "../../docs/screenshots");
    fs.mkdirSync(dir, { recursive: true });
    const width = info.project.use.viewport!.width;
    await page.screenshot({ path: path.join(dir, `home-${width}.png`), fullPage: true });
  });
});
