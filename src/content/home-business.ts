import type { Block } from "./types";

/** Homepage sections 7 to 15. Status meanings are documented in home.ts. */

export const chemistries: Block<{ names: string[]; offer: string; process: string }> = {
  id: "aroma-chemicals",
  status: "verified",
  data: {
    offer: "Bulk-manufactured ingredients and specialty ingredients made to order.",
    process:
      "Process expertise includes process consultation, reactive chromatography, reactive distillation, plug flow and CSTR.",
    names: [
      "Aldol condensation",
      "Cyclisation",
      "Diels-Alder reaction",
      "Darzens reaction",
      "Etherification",
      "Esterification",
      "Epoxidation",
      "Friedel-Crafts reaction",
      "Grignard reaction",
      "Selective hydrogenation",
      "Isomerisation",
      "Peroxide-based reactions",
      "Distillation",
      "Solvent extraction",
    ],
  },
};

export const tollManufacturing: Block<{ text: string }> = {
  id: "toll-manufacturing",
  status: "needs-client-confirmation",
  data: { text: "Contract research and toll manufacturing are also offered." },
};

export interface FlavourApp {
  name: string;
  summary: string;
}

export const flavourApplications: Block<FlavourApp>[] = [
  { id: "fl-confectionery", status: "verified", data: { name: "Confectionery", summary: "Hard boiled candies, toffees, chocolates and jellies, in fruity, chocolatey and creamy profiles." } },
  { id: "fl-bakery", status: "verified", data: { name: "Bakery", summary: "Flavours that enhance existing flavours or add a creative edge to baked goods." } },
  { id: "fl-beverages", status: "verified", data: { name: "Beverages", summary: "Soft drinks, smoothies, milkshakes, fruit juices and alcoholic beverages." } },
  { id: "fl-dairy", status: "verified", data: { name: "Dairy", summary: "Ice creams and smoothies, from ethnic flavours such as saffron to international favourites." } },
  { id: "fl-savoury", status: "verified", data: { name: "Savoury", summary: "Herbs, spices, nuts and condiments for snacks, soups, dressings and beverages." } },
];

export const flavourIntro: Block<{ lead: string }> = {
  id: "flavour-intro",
  status: "verified",
  data: {
    lead: "Flavours are the newest line in our business. We create and manufacture flavours that elevate and enhance the food experience.",
  },
};

export const flavourExtras: Block<{ text: string }> = {
  id: "flavour-shisha-mouth-fresheners",
  status: "needs-client-confirmation",
  data: { text: "Flavours for shisha and mouth fresheners are also part of the range." },
};

export const manufacturing: Block<{
  intro: string;
  sites: { name: string; area: string }[];
}> = {
  id: "manufacturing",
  status: "verified",
  data: {
    intro:
      "Fragrances are customised in our own laboratory and manufacturing facilities. Production is split across two sites in Maharashtra.",
    sites: [
      { name: "Chemical production", area: "Lote Parshuram MIDC, Khed, Ratnagiri" },
      { name: "Fragrance production", area: "Chinchghar Kudus, Wada, Palghar" },
    ],
  },
};

export const strengths: Block<{ items: { title: string; text: string }[] }> = {
  id: "strengths",
  status: "verified",
  data: {
    items: [
      { title: "Customisation", text: "Fragrances and ingredients tailored to each customer's requirements." },
      { title: "Technical support", text: "An experienced technical and sales team working alongside your development." },
      { title: "Cost-effective solutions", text: "Practical formulations and processes that respect your cost targets." },
      { title: "Short turnaround", text: "Focused on delivering results quickly." },
    ],
  },
};

export const leadershipVaze: Block<{ name: string; role: string; bio: string }> = {
  id: "leader-vaze",
  status: "verified",
  data: {
    name: "Girish Vaze",
    role: "Managing Director and Chief Perfumer",
    bio: "Founder and promoter of Aquila Organics. Holds an M.Sc. in Organic Chemistry from Mumbai University and an MBA in Finance. Earlier led the Aroma Ingredients Division at S.H. Kelkar and Company for almost a decade.",
  },
};

/** Executive Director appears on the live site but not in the brief; hidden until the client confirms. */
export const leadershipHattali: Block<{ name: string; role: string; bio: string }> = {
  id: "leader-hattali-pending-confirmation",
  status: "hidden",
  data: {
    name: "Gurudeo Hattali",
    role: "Executive Director",
    bio: "Production, R&D and pilot-plant experience across the chemical industry.",
  },
};

export const sustainability: Block<{ lead: string; items: { title: string; text: string }[] }> = {
  id: "sustainability",
  status: "verified",
  data: {
    lead: "We source ingredients locally where we can, comply with domestic and international regulatory guidelines, and treat ethical business practice as the basis of long-lasting relationships.",
    items: [
      { title: "Zero liquid waste policy", text: "Liquid waste is treated and converted into solid salts, which are disposed of through local channels." },
      { title: "Hazardous waste management", text: "Member of Mumbai Waste Management Ltd. for the treatment, storage and disposal of hazardous waste." },
      { title: "Community", text: "Local employment opportunities, support for a neighbouring village's water supply, and relief for local families during the pandemic." },
    ],
  },
};

export const globalReach: Block<{ lead: string; regions: string[] }> = {
  id: "global-reach",
  status: "brief-supplied",
  data: {
    lead: "Our customers are based in India and across these regions.",
    regions: ["India", "Middle East", "Africa", "APAC"],
  },
};

/** Certifications stay hidden until the client confirms issuers, scope and validity dates. */
export const certifications: Block<{ note: string }> = {
  id: "certifications-strip",
  status: "hidden",
  data: { note: "Awaiting client-confirmed certificates (see docs/content-verification.md section B)." },
};

export const enquiry: Block<{ title: string; text: string }> = {
  id: "enquiry-cta",
  status: "brief-supplied",
  data: {
    title: "Start a conversation about your next product.",
    text: "Tell us what you are developing, and our technical and sales team will respond.",
  },
};
