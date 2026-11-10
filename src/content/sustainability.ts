import { sustainability } from "./home-business";
import type { Block, PageSection } from "./types";

export const sustainabilityMeta = {
  title: "Sustainability",
  lead: sustainability.data.lead,
  description:
    "Aquila Organics' zero liquid waste policy, hazardous waste management and community activities.",
} as const;

export const sustainabilityBlocks: Block<PageSection>[] = sustainability.data.items.map((item, i) => ({
  id: `${sustainability.id}-${i + 1}`,
  status: sustainability.status,
  data: { kind: "paragraphs", heading: item.title, paragraphs: [item.text] },
}));

export const complianceMeta = {
  title: "Legal and regulatory compliance",
  lead: "What we hold on file, and what is still being confirmed.",
  description:
    "The regulatory and certification documents Aquila Organics holds on file, pending confirmation of what each covers.",
} as const;

/**
 * The previous website listed these files without issuer, scope or validity.
 * They are described here only as documents awaiting confirmation: no
 * regulation is named and no compliance is claimed.
 */
export const complianceBlocks: Block<PageSection>[] = [
  {
    id: "compliance-status",
    status: "needs-client-confirmation",
    data: {
      kind: "paragraphs",
      paragraphs: [
        "The previous Aquila website listed a set of regulatory and certification documents as downloadable files. Aquila has not yet confirmed what each one covers, which body issued it, or how long it is valid. Until that is confirmed, none of them is presented here as a current certification.",
      ],
    },
  },
  {
    id: "compliance-documents",
    status: "needs-client-confirmation",
    data: {
      kind: "list",
      heading: "Documents awaiting confirmation",
      items: [
        "An EC certificate letter",
        "Two six-month compliance reports (April to September 2025, and October 2025 to March 2026)",
        "A combined file of ISO certificates",
        "A Halal certificate and an add-on products list",
        "A Kosher certificate",
        "A US FDA certificate",
      ],
    },
  },
];
