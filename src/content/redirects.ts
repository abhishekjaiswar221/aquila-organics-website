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

/**
 * The old site was a Joomla install that served every page both at the clean URL and under
 * /index.php/..., so each rule also answers its /index.php variant with the same destination.
 * One hop each: no destination is itself a source (guarded by tests/unit/redirects.test.ts).
 */
export const redirectRules: RedirectRule[] = [
  // The old home page URL. It has no /index.php twin (that would be /index.php/index.php).
  { source: "/index.php", destination: "/" },
  ...redirectTable,
  ...redirectTable.map((r) => ({ source: `/index.php${r.source}`, destination: r.destination })),
];
