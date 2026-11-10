/**
 * The fixed application slugs, in their own module with no page copy. Client code (the contact form's
 * validator) imports this instead of src/content/segments.ts, so no content blocks, hidden ones
 * included, are pulled into a public JavaScript bundle just to check a slug.
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
