import type { Address, NavItem } from "./types";

export const company = {
  name: "Aquila Organics Private Limited",
  shortName: "Aquila Organics",
  tagline: "Where Science Meets Senses.",
} as const;

export const contacts = {
  general: "info@aquilaorganics.com",
  sales: "sales@aquilaorganics.com",
  fragrances: "fragrances@aquilaorganics.com",
  flavours: "flavors@aquilaorganics.com",
  hr: "hr@aquilaorganics.com",
  phoneAromaChemicals: { display: "+91 98193 43989", tel: "+919819343989" },
  phoneFragrancesFlavours: { display: "+91 82912 31180", tel: "+918291231180" },
  hours: "Monday to Saturday, 09:00 to 17:00",
} as const;

export const addresses: { registeredOffice: Address; headOffice: Address } = {
  registeredOffice: {
    label: "Registered office",
    lines: [
      "Office 101-104, Sunrise Business Park",
      "Plot B-68, Road No. 16, Wagle Industrial Estate",
      "Thane (W) 400 604, Maharashtra, India",
    ],
  },
  headOffice: {
    label: "Head office",
    lines: [
      "W-353, TTC Industrial Area, Rabale MIDC",
      "Navi Mumbai 400 701, Maharashtra, India",
    ],
  },
};

/**
 * Only routes that exist are available (tests/unit/navigation.test.ts checks this against the
 * sitemap). Careers stays unavailable until the careers sub-project ships and is omitted from
 * rendered navigation until then.
 */
export const primaryNav: NavItem[] = [
  {
    label: "Fragrances",
    href: "/fragrances",
    available: true,
    children: [
      "Fine Fragrance",
      "Personal Care",
      "Air Care",
      "Fabric Care",
      "Home Care",
      "Incense and Bakhoor",
    ].map((label) => ({ label, href: `/fragrances/${label.toLowerCase().replace(/ /g, "-")}`, available: true })),
  },
  { label: "Aroma Chemicals", href: "/aroma-chemicals", available: true },
  {
    label: "Flavours",
    href: "/flavours",
    available: true,
    children: ["Confectionery", "Bakery", "Beverages", "Dairy", "Savoury"].map((label) => ({
      label,
      href: `/flavours/${label.toLowerCase()}`,
      available: true,
    })),
  },
  { label: "About", href: "/about", available: true },
  { label: "Sustainability", href: "/sustainability", available: true },
  { label: "Careers", href: "/careers", available: false },
  { label: "Contact", href: "/contact", available: true },
];

/** Company links shown beside the segment menu in the desktop header (Contact is the header's call to action). */
export const headerNav: NavItem[] = [
  { label: "About", href: "/about", available: true },
  { label: "Sustainability", href: "/sustainability", available: true },
];

/** Company pages listed in the mobile drawer. */
export const companyNav: NavItem[] = [
  { label: "About", href: "/about", available: true },
  { label: "Innovation", href: "/innovation", available: true },
  { label: "Sustainability", href: "/sustainability", available: true },
  { label: "Contact", href: "/contact", available: true },
];

/** Secondary links in the footer. */
export const footerNav: NavItem[] = [
  { label: "About", href: "/about", available: true },
  { label: "Sustainability", href: "/sustainability", available: true },
  { label: "Contact", href: "/contact", available: true },
  { label: "Request a quotation", href: "/rfq", available: true },
  { label: "Privacy", href: "/privacy", available: true },
];

export interface SegmentMenuItem {
  label: string;
  href: string;
}

/**
 * The three business segments and what the menu lists under each. Every href is a real page
 * (tests/unit/navigation.test.ts), and the application labels and paths are checked against
 * src/content/segments.ts. Kept here, not imported from there, so the client-side menu does not
 * pull the page content into its bundle.
 */
export const segments: readonly {
  id: "fragrances" | "aroma-chemicals" | "flavours";
  label: string;
  href: string;
  items: readonly SegmentMenuItem[];
}[] = [
  {
    id: "fragrances",
    label: "Fragrances",
    href: "/fragrances",
    items: [
      { label: "Fine Fragrance", href: "/fragrances/fine-fragrance" },
      { label: "Personal Care", href: "/fragrances/personal-care" },
      { label: "Air Care", href: "/fragrances/air-care" },
      { label: "Fabric Care", href: "/fragrances/fabric-care" },
      { label: "Home Care", href: "/fragrances/home-care" },
      { label: "Incense and Bakhoor", href: "/fragrances/incense-and-bakhoor" },
    ],
  },
  {
    id: "aroma-chemicals",
    label: "Aroma Chemicals",
    href: "/aroma-chemicals",
    items: [
      { label: "Product catalogue", href: "/aroma-chemicals" },
      { label: "Innovation and capabilities", href: "/innovation" },
      { label: "Request a quotation", href: "/rfq" },
    ],
  },
  {
    id: "flavours",
    label: "Flavours",
    href: "/flavours",
    items: [
      { label: "Confectionery", href: "/flavours/confectionery" },
      { label: "Bakery", href: "/flavours/bakery" },
      { label: "Beverages", href: "/flavours/beverages" },
      { label: "Dairy", href: "/flavours/dairy" },
      { label: "Savoury", href: "/flavours/savoury" },
    ],
  },
];
