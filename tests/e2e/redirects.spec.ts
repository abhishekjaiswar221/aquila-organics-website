import { expect, test, type APIRequestContext } from "@playwright/test";
import { redirectRules } from "../../src/content/redirects";

/*
 * Old-site URLs for pages that now exist. Redirects do not depend on the viewport, so the checks run
 * once, in the widest project.
 */
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "w1280", "redirects are viewport independent");
});

const pathOf = (location: string | undefined): string => {
  expect(location, "Location header").toBeTruthy();
  const u = new URL(location ?? "", "http://localhost");
  return u.pathname + u.search;
};

/** Follows redirects by hand and returns every hop's status and the final status. */
async function trace(request: APIRequestContext, start: string): Promise<{ hops: number[]; final: number; path: string }> {
  const hops: number[] = [];
  let current = start;
  for (let i = 0; i < 6; i++) {
    const res = await request.get(current, { maxRedirects: 0 });
    if (res.status() >= 300 && res.status() < 400) {
      hops.push(res.status());
      current = pathOf(res.headers()["location"]);
      continue;
    }
    return { hops, final: res.status(), path: current };
  }
  throw new Error(`Too many redirects from ${start}`);
}

test.describe("every old URL", () => {
  for (const rule of redirectRules) {
    test(`${rule.source} answers one 301 to ${rule.destination}`, async ({ request }) => {
      const res = await request.get(rule.source, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(pathOf(res.headers()["location"])).toBe(rule.destination);
      const dest = await request.get(rule.destination, { maxRedirects: 0 });
      expect(dest.status()).toBe(200);
    });
  }
});

test.describe("redirect behaviour", () => {
  test("keeps the query string", async ({ request }) => {
    const res = await request.get("/contactus?ref=abc&x=1", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(pathOf(res.headers()["location"])).toBe("/contact?ref=abc&x=1");
  });

  // Next.js applies its own trailing-slash redirect (308) before any custom redirect, so an old URL
  // that ends in "/" needs two hops: 308 to the slash-less URL, then our 301. The clean URL (no
  // trailing slash, what the old site and search engines use) is a single hop, asserted above.
  // Documented in docs/url-migration.md; this pins the behaviour so a change in Next.js is noticed.
  test("answers a trailing-slash URL with Next's 308 then our 301, and reaches the page", async ({ request }) => {
    for (const url of ["/flavors/", "/about/our-company/", "/index.php/fine-fragrances/"]) {
      const t = await trace(request, url);
      expect(t.hops, url).toEqual([308, 301]);
      expect(t.final).toBe(200);
    }
  });

  test("never chains: every old URL reaches a 200 page in exactly one hop", async ({ request }) => {
    for (const rule of redirectRules.slice(0, 12)) {
      const t = await trace(request, rule.source);
      expect(t.hops, rule.source).toEqual([301]);
      expect(t.final).toBe(200);
      expect(t.path).toBe(rule.destination);
    }
  });

  test("leaves live pages alone", async ({ request }) => {
    for (const url of ["/", "/aroma-chemicals", "/privacy", "/rfq", "/contact", "/about", "/fragrances", "/flavours"]) {
      const t = await trace(request, url);
      expect(t.hops, url).toEqual([]);
      expect(t.final, url).toBe(200);
    }
  });

  test("does not redirect an unknown old-style URL", async ({ request }) => {
    const res = await request.get("/fragrance-oils", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });
});
