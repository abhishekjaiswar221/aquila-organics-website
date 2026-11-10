import { chemistries, manufacturing, tollManufacturing } from "./home-business";
import type { Block, PageSection } from "./types";

/**
 * Innovation and capabilities. Only what the live site and the brief support:
 * the listed chemistries, process expertise and the own laboratory and
 * manufacturing wording. No capacities, equipment, headcount or R&D claims
 * until the client supplies them.
 */

export const innovationMeta = {
  title: "Innovation and capabilities",
  lead: chemistries.data.offer,
  description:
    "Aroma chemical manufacturing capabilities at Aquila Organics: synthetic chemistries, process expertise and made-to-order ingredients.",
} as const;

export const innovationBlocks: Block<PageSection>[] = [
  {
    id: "innovation-offer",
    status: chemistries.status,
    data: {
      kind: "paragraphs",
      paragraphs: [chemistries.data.offer, chemistries.data.process],
    },
  },
  {
    id: chemistries.id,
    status: chemistries.status,
    data: { kind: "list", heading: "Chemistries we work with", items: chemistries.data.names },
  },
  {
    id: "innovation-laboratory",
    status: manufacturing.status,
    data: { kind: "paragraphs", heading: "Laboratory and manufacturing", paragraphs: [manufacturing.data.intro] },
  },
  {
    id: tollManufacturing.id,
    status: tollManufacturing.status,
    data: { kind: "paragraphs", paragraphs: [tollManufacturing.data.text] },
  },
];
