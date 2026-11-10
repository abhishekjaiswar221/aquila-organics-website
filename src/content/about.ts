import { intro } from "./home";
import { globalReach, leadershipHattali, leadershipVaze, manufacturing } from "./home-business";
import type { Block, PageSection } from "./types";

/** About page. Reuses the homepage's verified and brief-supplied blocks; nothing new is claimed here. */

export const aboutMeta = {
  title: "About Aquila Organics",
  lead: "A manufacturing partner for fragrance and flavour makers.",
  description:
    "Aquila Organics Private Limited manufactures fragrances and aroma chemicals, with a growing presence in flavours.",
} as const;

export const aboutBlocks: Block<PageSection>[] = [
  {
    id: "about-intro",
    status: intro.status,
    data: { kind: "paragraphs", paragraphs: intro.data.paragraphs },
  },
  {
    id: "about-segments",
    status: "verified",
    data: { kind: "list", heading: "What we make", items: ["Fragrances", "Aroma chemicals", "Flavours"] },
  },
  {
    id: "about-industries",
    status: intro.status,
    data: { kind: "list", heading: "Industries we serve", items: intro.data.industries },
  },
  {
    id: leadershipVaze.id,
    status: leadershipVaze.status,
    data: {
      kind: "paragraphs",
      heading: "Leadership",
      paragraphs: [`${leadershipVaze.data.name}, ${leadershipVaze.data.role}`, leadershipVaze.data.bio],
    },
  },
  {
    // Appears on the live site but not in the owner's brief: hidden until the client confirms.
    id: leadershipHattali.id,
    status: leadershipHattali.status,
    data: {
      kind: "paragraphs",
      heading: "Leadership",
      paragraphs: [`${leadershipHattali.data.name}, ${leadershipHattali.data.role}`, leadershipHattali.data.bio],
    },
  },
  {
    id: manufacturing.id,
    status: manufacturing.status,
    data: {
      kind: "list",
      heading: "Where we make our products",
      items: manufacturing.data.sites.map((s) => `${s.name}: ${s.area}`),
    },
  },
  {
    id: globalReach.id,
    status: globalReach.status,
    data: { kind: "list", heading: "Where our customers are", items: globalReach.data.regions },
  },
];
