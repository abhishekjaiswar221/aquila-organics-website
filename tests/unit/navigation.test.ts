import { describe, expect, it } from "vitest";
import { segmentBlocks } from "@/content/home";
import { flavourSegment, fragranceSegment } from "@/content/segments";
import { companyNav, footerNav, headerNav, primaryNav, segments } from "@/content/site";
import { buildSitemap } from "@/lib/seo/sitemap";

const LIVE = new Set<string>([
  ...buildSitemap("https://example.test", [], { certificationsIndexable: true }).map((e) => new URL(e.url).pathname),
  "/rfq",
]);

const flatten = (items: typeof primaryNav): typeof primaryNav => items.flatMap((i) => [i, ...flatten(i.children ?? [])]);

describe("segment menu data", () => {
  it("links every segment and every item to a page that exists, never to an anchor or '#'", () => {
    for (const s of segments) {
      expect(LIVE.has(s.href), s.href).toBe(true);
      for (const item of s.items) {
        expect(LIVE.has(item.href), `${s.id}: ${item.label}`).toBe(true);
        expect(item.href).not.toContain("#");
      }
    }
  });

  it("lists the fragrance and flavour applications by their real page", () => {
    const frag = segments.find((s) => s.id === "fragrances");
    const flav = segments.find((s) => s.id === "flavours");
    expect(frag?.items.map((i) => i.href)).toEqual([
      "/fragrances/fine-fragrance",
      "/fragrances/personal-care",
      "/fragrances/air-care",
      "/fragrances/fabric-care",
      "/fragrances/home-care",
      "/fragrances/incense-and-bakhoor",
    ]);
    expect(flav?.items.map((i) => i.href)).toEqual([
      "/flavours/confectionery",
      "/flavours/bakery",
      "/flavours/beverages",
      "/flavours/dairy",
      "/flavours/savoury",
    ]);
  });
});

describe("segment menu stays in step with the content records", () => {
  it("uses the application names and paths from src/content/segments.ts", () => {
    for (const [id, segment] of [
      ["fragrances", fragranceSegment],
      ["flavours", flavourSegment],
    ] as const) {
      const menu = segments.find((s) => s.id === id);
      expect(menu?.items.map((i) => i.label)).toEqual(segment.applications.map((a) => a.name));
      expect(menu?.items.map((i) => i.href)).toEqual(segment.applications.map((a) => `${segment.path}/${a.slug}`));
    }
  });
});

describe("header, drawer and homepage links", () => {
  it("only list company pages that exist", () => {
    for (const item of [...headerNav, ...companyNav]) {
      expect(item.available, item.href).toBe(true);
      expect(LIVE.has(item.href), item.href).toBe(true);
    }
  });

  it("send the homepage segment cards to the real segment pages, not to homepage anchors", () => {
    for (const b of segmentBlocks) {
      expect(LIVE.has(b.data.href), b.data.href).toBe(true);
      expect(b.data.href).not.toContain("#");
    }
  });
});

describe("primaryNav availability", () => {
  it("marks a route available only when the page exists", () => {
    for (const item of flatten(primaryNav)) {
      expect(LIVE.has(item.href), item.href).toBe(item.available);
    }
  });

  it("keeps Careers unavailable until the careers sub-project ships", () => {
    expect(primaryNav.find((i) => i.label === "Careers")?.available).toBe(false);
  });
});

describe("footer links", () => {
  it("are all available routes that exist", () => {
    for (const item of footerNav) {
      expect(item.available, item.href).toBe(true);
      expect(LIVE.has(item.href), item.href).toBe(true);
    }
  });

  it("include About, Sustainability and Contact", () => {
    const hrefs = footerNav.map((i) => i.href);
    for (const h of ["/about", "/sustainability", "/contact"]) expect(hrefs).toContain(h);
  });
});
