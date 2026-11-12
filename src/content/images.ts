import imageData from "./image-data.generated.json";

/*
 * Every photo on the site is registered here against a named slot: the file, its alt text and where it came
 * from. ImageFrame looks the slot up; a slot with no entry renders the neutral placeholder.
 *
 * Sources:
 *  - "stock":  free-commercial stock (Pexels or Unsplash). The photographer, licence and photo page are
 *              recorded and listed in docs/image-credits.md. Stock is generic imagery and must never be
 *              presented as Aquila's own facilities, people or products.
 *  - "client": taken from the current Aquila website (https://aquilaorganics.com) with the owner's approval.
 *
 * Add photos with `npm run images:prepare` (see scripts/prepare-images.ts), then register them here.
 * tests/unit/images.test.ts enforces the rules below.
 */

export const IMAGE_SLOTS = [
  "hero",
  "fragrance-section",
  "fragrance-fine-fragrance",
  "fragrance-personal-care",
  "fragrance-air-care",
  "fragrance-fabric-care",
  "fragrance-home-care",
  "fragrance-incense-and-bakhoor",
  "flavour-confectionery",
  "flavour-bakery",
  "flavour-beverages",
  "flavour-dairy",
  "flavour-savoury",
  "manufacturing",
] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

/**
 * Slots that show Aquila itself (its plants, people, laboratory). Only real Aquila photographs may ever fill
 * these: a test rejects stock here, so generic imagery can never pass as the company's own.
 */
export const FACTORY_SLOTS: readonly ImageSlot[] = ["manufacturing"];

export type ImageCredit = { photographer: string; site: "Pexels" | "Unsplash"; license: string; pageUrl: string };
export type ImageEntry =
  | { file: string; alt: string; source: "stock"; credit: ImageCredit }
  | { file: string; alt: string; source: "client"; origin: string };

export const images: Partial<Record<ImageSlot, ImageEntry>> = {
  "hero": {
    file: "/images/stock/hero.webp",
    alt: "Amber glass bottles standing among scattered dried chamomile and lavender flowers on a pale surface",
    source: "stock",
    credit: {
      photographer: "Tara Winstead",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/bown-bottles-used-for-herbal-oils-6694216/",
    },
  },
  "fragrance-section": {
    file: "/images/stock/fragrance-section.webp",
    alt: "Stone bowl holding pale resin pieces and dried botanicals on a dark wooden table with a small spoon",
    source: "stock",
    credit: {
      photographer: "Christina & Peter",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/ingredients-in-bowl-25676797/",
    },
  },
  "fragrance-fine-fragrance": {
    file: "/images/stock/fragrance-fine-fragrance.webp",
    alt: "Glass spray bottle of golden liquid on a pale surface scattered with small dried flowers",
    source: "stock",
    credit: {
      photographer: "Alesia Kozik",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/perfume-bottle-on-a-white-surface-surrounded-by-dried-flowers-7796498/",
    },
  },
  "fragrance-personal-care": {
    file: "/images/stock/fragrance-personal-care.webp",
    alt: "Glass jar of stacked soap bars beside a wooden body brush on soft white linen",
    source: "stock",
    credit: {
      photographer: "Ron Lach",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/jar-with-soaps-and-body-brush-10574793/",
    },
  },
  "fragrance-air-care": {
    file: "/images/stock/fragrance-air-care.webp",
    alt: "Reed diffuser with wooden sticks in a frosted amber glass bottle on a small wooden tray",
    source: "stock",
    credit: {
      photographer: "Hanna Pad",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/close-up-shot-of-diffuser-sticks-8533213/",
    },
  },
  "fragrance-fabric-care": {
    file: "/images/stock/fragrance-fabric-care.webp",
    alt: "Stack of folded linen garments in olive, terracotta and cream beside dried grasses on a wooden table",
    source: "stock",
    credit: {
      photographer: "Pavel Danilyuk",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/a-stack-of-folded-clothes-on-the-table-6461392/",
    },
  },
  "fragrance-home-care": {
    file: "/images/stock/fragrance-home-care.webp",
    alt: "Bowl of fresh lemons resting on a white fringed linen cloth on an oak table",
    source: "stock",
    credit: {
      photographer: "Tara Winstead",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/fresh-lemons-on-bowl-on-cloth-6489623/",
    },
  },
  "flavour-confectionery": {
    file: "/images/stock/flavour-confectionery.webp",
    alt: "Broken pieces of dark chocolate with caramel drizzle and fine shavings on a white plate",
    source: "stock",
    credit: {
      photographer: "alleksana",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/close-up-shot-of-dark-chocolates-on-a-white-surface-4113352/",
    },
  },
  "flavour-bakery": {
    file: "/images/stock/flavour-bakery.webp",
    alt: "Dark ceramic bowl of flour with a spoon beside golden baked buns on a rustic wooden table",
    source: "stock",
    credit: {
      photographer: "Gülsüm Çoban",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/rustic-bread-and-flour-on-wooden-table-32525228/",
    },
  },
  "flavour-beverages": {
    file: "/images/stock/flavour-beverages.webp",
    alt: "Tall glass of lemonade with mint and lemon slice among whole lemons on cream draped fabric",
    source: "stock",
    credit: {
      photographer: "Beyza Şükran DEMİRBAŞ",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/refreshing-glass-of-lemonade-with-fresh-lemons-33107433/",
    },
  },
  "flavour-dairy": {
    file: "/images/stock/flavour-dairy.webp",
    alt: "Glass bottle and drinking glass of fresh milk standing on a dark wooden table",
    source: "stock",
    credit: {
      photographer: "Charlotte May",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/bottle-and-glass-of-milk-at-home-5946717/",
    },
  },
  "flavour-savoury": {
    file: "/images/stock/flavour-savoury.webp",
    alt: "Wooden bowl of whole black peppercorns beside red onion, garlic bulbs and leafy herbs",
    source: "stock",
    credit: {
      photographer: "Tatyana Novoselova",
      site: "Pexels",
      license: "Pexels License",
      pageUrl: "https://www.pexels.com/photo/a-wooden-bowl-with-whole-peppercorns-beside-other-ingredients-8922293/",
    },
  },
  "fragrance-incense-and-bakhoor": {
    file: "/images/client/incense-and-bakhoor-main.webp",
    alt: "Lit incense sticks standing in a holder in front of softly blurred warm lights",
    source: "client",
    origin: "https://aquilaorganics.com/images/media/fagrance/incense-bakhoor/incense-and-bakhoor-main.jpg",
  },
};

/** The Aquila logo as published on the current website (black mark on a transparent background). */
export const logo = {
  file: "/images/client/hor-logo-new.webp",
  alt: "Aquila Organics",
  origin: "https://aquilaorganics.com/images/logod/hor_logo_new.png",
} as const;

export type ImageFileData = { width: number; height: number; blurDataURL: string };
const fileData = imageData as Record<string, ImageFileData>;

/** Size and blur preview for a processed image file (undefined if the file was never prepared). */
export function imageFileData(file: string): ImageFileData | undefined {
  return fileData[file];
}

export type ResolvedImage = ImageEntry & ImageFileData;

/** The registered photo for a slot with its dimensions, or undefined when the slot is still a placeholder. */
export function getImage(slot: ImageSlot): ResolvedImage | undefined {
  const entry = images[slot];
  const data = entry ? fileData[entry.file] : undefined;
  return entry && data ? { ...entry, ...data } : undefined;
}

const SLOT_SET: ReadonlySet<string> = new Set(IMAGE_SLOTS);

/** The slot for an application page (segment "fragrances" or "flavours" plus its slug), if one exists. */
export function applicationSlot(segmentId: string, slug: string): ImageSlot | undefined {
  const prefix = segmentId === "fragrances" ? "fragrance" : segmentId === "flavours" ? "flavour" : null;
  const slot = prefix ? `${prefix}-${slug}` : "";
  return SLOT_SET.has(slot) ? (slot as ImageSlot) : undefined;
}
