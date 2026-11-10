import { fragranceApplications, fragranceIntro, oudhEmphasis } from "./home";
import { flavourApplications, flavourExtras, flavourIntro } from "./home-business";
import type { ApplicationRecord, Block, PageSection, SegmentRecord } from "./types";

/**
 * Fragrance and flavour segments. Application names and one-line summaries are
 * reused from the homepage blocks so the two pages cannot drift apart.
 */

export const APPLICATION_SLUGS = {
  fragrances: [
    "fine-fragrance",
    "personal-care",
    "air-care",
    "fabric-care",
    "home-care",
    "incense-and-bakhoor",
  ],
  flavours: ["confectionery", "bakery", "beverages", "dairy", "savoury"],
} as const;

export type SegmentId = keyof typeof APPLICATION_SLUGS;

const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Incense and bakhoor sub-types named on the live site, in its order. */
const incenseBlocks: Block<PageSection>[] = [
  {
    id: "incense-subtypes",
    status: "verified",
    data: {
      kind: "list",
      heading: "Incense and bakhoor types",
      items: ["Bakhoor", "Flora Batti", "Incense Cone", "Masala Batti", "Scented Batti"],
    },
  },
  {
    id: oudhEmphasis.id,
    status: oudhEmphasis.status,
    data: { kind: "quote", eyebrow: oudhEmphasis.data.eyebrow, text: oudhEmphasis.data.text },
  },
];

function toRecord(name: string, summary: string, blocks: Block<PageSection>[] = []): ApplicationRecord {
  return { slug: slugOf(name), name, summary, blocks };
}

const fragranceRecords = fragranceApplications.map((b) =>
  toRecord(b.data.name, b.data.summary, b.data.name === "Incense and Bakhoor" ? incenseBlocks : []),
);
const flavourRecords = flavourApplications.map((b) => toRecord(b.data.name, b.data.summary));

export const fragranceSegment: SegmentRecord = {
  id: "fragrances",
  name: "Fragrances",
  path: "/fragrances",
  lead: { id: fragranceIntro.id, status: fragranceIntro.status, data: fragranceIntro.data.body },
  applications: fragranceRecords,
  extras: [],
};

export const flavourSegment: SegmentRecord = {
  id: "flavours",
  name: "Flavours",
  path: "/flavours",
  lead: { id: flavourIntro.id, status: flavourIntro.status, data: flavourIntro.data.lead },
  applications: flavourRecords,
  extras: [
    {
      id: flavourExtras.id,
      status: flavourExtras.status,
      data: { kind: "paragraphs", paragraphs: [flavourExtras.data.text] },
    },
  ],
};

const segments: Record<SegmentId, SegmentRecord> = {
  fragrances: fragranceSegment,
  flavours: flavourSegment,
};

/** Case-sensitive slug lookup; returns undefined for anything not in the fixed lists. */
export function findApplication(segmentId: SegmentId, slug: string): ApplicationRecord | undefined {
  const segment = segments[segmentId];
  if (!segment) return undefined;
  return segment.applications.find((a) => a.slug === slug);
}

const CONSULTATION_TYPE: Record<SegmentId, "FRAGRANCES" | "FLAVOURS"> = {
  fragrances: "FRAGRANCES",
  flavours: "FLAVOURS",
};

/** Deep link into the Contact page's matching form, optionally with the application preselected. */
export function consultationHref(segmentId: SegmentId, applicationSlug?: string): string {
  const base = `/contact?type=${CONSULTATION_TYPE[segmentId]}`;
  return applicationSlug ? `${base}&application=${applicationSlug}` : base;
}

export function applicationPath(segmentId: SegmentId, slug: string): string {
  return `${segments[segmentId].path}/${slug}`;
}
