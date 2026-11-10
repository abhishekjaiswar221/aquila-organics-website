/**
 * Old-site URLs for pages that now exist, each mapped to its new home with a
 * single permanent redirect. Consumed by next.config.ts (Task 7); a unit test
 * guards against chains, loops and self-redirects.
 */
export interface RedirectRule {
  source: string;
  destination: string;
}

export const redirectTable: RedirectRule[] = [
  { source: "/fragrance", destination: "/fragrances" },
  { source: "/flavors", destination: "/flavours" },
  { source: "/fine-fragrances", destination: "/fragrances/fine-fragrance" },
  { source: "/personal-care", destination: "/fragrances/personal-care" },
  { source: "/air-care", destination: "/fragrances/air-care" },
  { source: "/fabric-care", destination: "/fragrances/fabric-care" },
  { source: "/home-care", destination: "/fragrances/home-care" },
  { source: "/incense-and-bakhoor", destination: "/fragrances/incense-and-bakhoor" },
  { source: "/confectionery", destination: "/flavours/confectionery" },
  { source: "/bakery", destination: "/flavours/bakery" },
  { source: "/beverages", destination: "/flavours/beverages" },
  { source: "/dairy", destination: "/flavours/dairy" },
  { source: "/savoury", destination: "/flavours/savoury" },
  { source: "/about/our-company", destination: "/about" },
  { source: "/about/sustainability", destination: "/sustainability" },
  { source: "/about/certifications", destination: "/sustainability/compliance" },
  { source: "/about/certification", destination: "/sustainability/certifications" },
  { source: "/contactus", destination: "/contact" },
];
