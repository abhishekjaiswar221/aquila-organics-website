// Page quality gates shared by the e2e specs: no horizontal overflow, axe
// (WCAG 2.0/2.1/2.2 A and AA) clean, one h1 and no skipped heading levels.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

export async function expectNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

export async function expectAxeClean(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

export async function expectHeadingOutline(page: Page): Promise<void> {
  await expect(page.locator("h1")).toHaveCount(1);
  const levels = await page.$$eval("h1,h2,h3,h4,h5,h6", (hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i] - levels[i - 1], `heading #${i}`).toBeLessThanOrEqual(1);
  }
}
