import type { Block } from "./types";

/**
 * Homepage copy. Statuses:
 *  verified                  - taken from the live aquilaorganics.com site
 *  brief-supplied            - from the client brief; not on the live site
 *  needs-client-confirmation - rendered, but flagged for sign-off before launch
 *  hidden                    - never rendered
 * See docs/content-verification.md.
 */

export interface HeroData {
  eyebrow: string;
  headline: string;
  lead: string;
}

export const hero: Block<HeroData> = {
  id: "hero",
  status: "brief-supplied",
  data: {
    eyebrow: "Fragrances · Aroma Chemicals · Flavours",
    headline: "Where Science Meets Senses.",
    lead: "Aquila Organics is an Indian manufacturer of fragrances and aroma chemicals, with a growing presence in flavours. Fragrance artistry, chemical science and a close understanding of consumer needs, brought together as a manufacturing partner.",
  },
};

export interface IntroData {
  paragraphs: string[];
  industries: string[];
}

export const intro: Block<IntroData> = {
  id: "intro",
  status: "brief-supplied",
  data: {
    paragraphs: [
      "Aquila Organics offers a wide range of fragrances, shaped by a close understanding of consumer needs. We are committed to manufacturing high-quality fragrances and to the customers we serve.",
      "Our experienced technical and sales professionals work from our own laboratory and manufacturing facilities, where fragrances are customised to each customer's requirements.",
      "Under the guidance of Mr. Girish Vaze, Managing Director, the company has built a strong position in the fragrance and flavour industry, with products recognised for quality and service.",
    ],
    industries: ["Fine fragrances", "Personal care", "Cosmetics", "Air care", "Fabric care", "Home care"],
  },
};

export interface SegmentData {
  id: "fragrances" | "aroma-chemicals" | "flavours";
  title: string;
  summary: string;
  href: string;
}

export const segmentBlocks: Block<SegmentData>[] = [
  {
    id: "segment-fragrances",
    status: "verified",
    data: {
      id: "fragrances",
      title: "Fragrances",
      summary:
        "A fragrance library that keeps evolving, created for fine fragrance, personal care, air care, fabric care, home care, incense and bakhoor.",
      href: "/#fragrances",
    },
  },
  {
    id: "segment-aroma-chemicals",
    status: "verified",
    data: {
      id: "aroma-chemicals",
      title: "Aroma Chemicals",
      summary:
        "Bulk-manufactured and specialty ingredients made to order, supported by a range of synthetic chemistries.",
      href: "/#aroma-chemicals",
    },
  },
  {
    id: "segment-flavours",
    status: "verified",
    data: {
      id: "flavours",
      title: "Flavours",
      summary:
        "A newer business line: flavours for confectionery, bakery, beverages, dairy and savoury foods.",
      href: "/#flavours",
    },
  },
];

export interface ApplicationData {
  name: string;
  summary: string;
}

export const fragranceIntro: Block<{ heading: string; body: string }> = {
  id: "fragrance-intro",
  status: "verified",
  data: {
    heading: "Fragrances for the products people use every day",
    body: "Our perfumers work with customers on fragrances for six application areas, each with its own technical demands.",
  },
};

export const fragranceApplications: Block<ApplicationData>[] = [
  {
    id: "app-fine-fragrance",
    status: "verified",
    data: {
      name: "Fine Fragrance",
      summary: "Perfumers help customers express their individuality through fine fragrance.",
    },
  },
  {
    id: "app-personal-care",
    status: "verified",
    data: { name: "Personal Care", summary: "Fragrances designed to complement the final product." },
  },
  {
    id: "app-air-care",
    status: "verified",
    data: { name: "Air Care", summary: "Fragrances for passive and active air fresheners." },
  },
  {
    id: "app-fabric-care",
    status: "verified",
    data: { name: "Fabric Care", summary: "Fragrances that keep clothes smelling fresh after the wash cycle." },
  },
  {
    id: "app-home-care",
    status: "verified",
    data: {
      name: "Home Care",
      summary: "Surface cleaners, bath and kitchen care, and similar household products.",
    },
  },
  {
    id: "app-incense-bakhoor",
    status: "verified",
    data: {
      name: "Incense and Bakhoor",
      summary:
        "Fragrances designed for strength, diffusion and retentivity in incense sticks, dhoop, cones and bakhoor.",
    },
  },
];

export const oudhEmphasis: Block<{ eyebrow: string; text: string }> = {
  id: "oudh-bakhoor-arabic",
  status: "brief-supplied",
  data: {
    eyebrow: "A distinctive area of expertise",
    text: "Our expertise in Oudhs, Bakhoors and Arabic fragrance notes gives us a distinctive position in the market.",
  },
};
