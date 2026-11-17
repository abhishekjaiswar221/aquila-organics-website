import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FACTORY_SLOTS,
  IMAGE_SLOTS,
  applicationSlot,
  getImage,
  galleries,
  imageFileData,
  images,
  logo,
  type ImageSlot,
} from "@/content/images";
import { APPLICATION_SLUGS } from "@/content/application-slugs";

const publicFile = (file: string) => path.resolve(__dirname, "../../public", file.replace(/^\//, ""));
const entries = Object.entries(images) as [ImageSlot, NonNullable<(typeof images)[ImageSlot]>][];

describe("image registry", () => {
  it("only registers known slots", () => {
    for (const [slot] of entries) expect(IMAGE_SLOTS, slot).toContain(slot);
  });

  it("every registered image exists on disk, was prepared (has size and blur data) and is reasonably small", () => {
    for (const [slot, e] of entries) {
      expect(existsSync(publicFile(e.file)), `${slot}: ${e.file}`).toBe(true);
      const data = imageFileData(e.file);
      expect(data, `${slot}: run npm run images:prepare`).toBeDefined();
      expect(data?.width).toBeGreaterThan(0);
      expect(data?.blurDataURL.startsWith("data:image/webp;base64,")).toBe(true);
      expect(statSync(publicFile(e.file)).size, slot).toBeLessThan(600 * 1024);
    }
  });

  it("every image has descriptive alt text, with no marketing claims", () => {
    for (const [slot, e] of entries) {
      const words = e.alt.trim().split(/\s+/).length;
      expect(words, slot).toBeGreaterThanOrEqual(6);
      expect(words, slot).toBeLessThanOrEqual(25);
      expect(e.alt.toLowerCase(), slot).not.toMatch(/\b(aquila|our|premium|best|leading|world-class)\b/);
    }
  });

  it("stock images record the photographer, a recognised licence and the photo page", () => {
    for (const [slot, e] of entries) {
      if (e.source !== "stock") continue;
      expect(e.credit.photographer.length, slot).toBeGreaterThan(1);
      expect(["Pexels License", "Unsplash License"], slot).toContain(e.credit.license);
      expect(e.credit.pageUrl, slot).toMatch(/^https:\/\/(www\.)?(pexels|unsplash)\.com\/photo/);
      expect(e.credit.pageUrl.startsWith("https://www.pexels.com") ? "Pexels" : "Unsplash", slot).toBe(e.credit.site);
    }
  });

  it("client images name where they were taken from", () => {
    for (const [slot, e] of entries) {
      if (e.source !== "client") continue;
      expect(e.origin, slot).toMatch(/^https:\/\/aquilaorganics\.com\//);
    }
    expect(logo.origin).toMatch(/^https:\/\/aquilaorganics\.com\//);
    expect(existsSync(publicFile(logo.file))).toBe(true);
  });

  it("never lets stock stand in for Aquila's own facilities or people", () => {
    for (const slot of FACTORY_SLOTS) {
      const e = images[slot];
      if (e) expect(e.source, `${slot} must only ever hold a real Aquila photograph`).toBe("client");
    }
  });

  it("does not share one file between two slots", () => {
    const files = entries.map(([, e]) => e.file);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe("application slots", () => {
  it("maps every fragrance and flavour application page to a registered photo", () => {
    for (const [segment, slugs] of Object.entries(APPLICATION_SLUGS)) {
      for (const slug of slugs) {
        const slot = applicationSlot(segment, slug);
        expect(slot, `${segment}/${slug}`).toBeDefined();
        expect(slot && getImage(slot), `${segment}/${slug} has no photo`).toBeDefined();
      }
    }
  });

  it("returns nothing for unknown segments or slugs", () => {
    expect(applicationSlot("fragrances", "nope")).toBeUndefined();
    expect(applicationSlot("blog", "fine-fragrance")).toBeUndefined();
  });

  it("keeps the manufacturing slot as a placeholder until a real Aquila photograph exists", () => {
    expect(getImage("manufacturing")).toBeUndefined();
  });
});

describe("galleries", () => {
  const items = Object.entries(galleries).flatMap(([slug, g]) => g.items.map((item) => ({ slug, item })));

  it("belong to real fragrance application pages", () => {
    for (const slug of Object.keys(galleries)) expect(APPLICATION_SLUGS.fragrances, slug).toContain(slug);
  });

  it("every item exists on disk, is prepared, captioned, described and traceable to the old site", () => {
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const { slug, item } of items) {
      const label = `${slug}: ${item.caption}`;
      expect(existsSync(publicFile(item.file)), label).toBe(true);
      expect(imageFileData(item.file), label).toBeDefined();
      expect(statSync(publicFile(item.file)).size, label).toBeLessThan(600 * 1024);
      expect(item.caption.length, label).toBeGreaterThan(2);
      const words = item.alt.trim().split(/\s+/).length;
      expect(words, label).toBeGreaterThanOrEqual(6);
      expect(words, label).toBeLessThanOrEqual(25);
      expect(item.origin, label).toMatch(/^https:\/\/aquilaorganics\.com\/images\/media\//);
    }
  });

  it("does not repeat a photo within one gallery", () => {
    for (const [slug, g] of Object.entries(galleries)) {
      const files = g.items.map((i) => i.file);
      expect(new Set(files).size, slug).toBe(files.length);
    }
  });
});

describe("credits document", () => {
  it("lists every stock photo's photo page", () => {
    const doc = readFileSync(path.resolve(__dirname, "../../docs/image-credits.md"), "utf8");
    for (const [slot, e] of entries) {
      if (e.source === "stock") expect(doc, slot).toContain(e.credit.pageUrl);
      if (e.source === "client") expect(doc, slot).toContain(e.origin);
    }
    expect(doc).toContain(logo.origin);
    for (const { origin } of Object.values(galleries).flatMap((g) => g.items)) expect(doc, origin).toContain(origin);
    expect(doc).toMatch(/Licensing warning/);
  });
});
