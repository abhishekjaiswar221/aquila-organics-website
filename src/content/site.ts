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
 * Only routes that exist are available: the homepage and the aroma chemicals
 * catalogue (sub-project 2). Every other route is listed with
 * available: false and is omitted from rendered navigation until its
 * sub-project delivers it.
 */
export const primaryNav: NavItem[] = [
  {
    label: "Fragrances",
    href: "/fragrances",
    available: false,
    children: [
      "Fine Fragrance",
      "Personal Care",
      "Air Care",
      "Fabric Care",
      "Home Care",
      "Incense and Bakhoor",
    ].map((label) => ({ label, href: `/fragrances/${label.toLowerCase().replace(/ /g, "-")}`, available: false })),
  },
  { label: "Aroma Chemicals", href: "/aroma-chemicals", available: true },
  {
    label: "Flavours",
    href: "/flavours",
    available: false,
    children: ["Confectionery", "Bakery", "Beverages", "Dairy", "Savoury"].map((label) => ({
      label,
      href: `/flavours/${label.toLowerCase()}`,
      available: false,
    })),
  },
  { label: "About", href: "/about", available: false },
  { label: "Sustainability", href: "/sustainability", available: false },
  { label: "Careers", href: "/careers", available: false },
  { label: "Contact", href: "/contact", available: false },
];

/** Secondary links in the footer (sub-project 2: the draft privacy notice and the RFQ form). */
export const footerNav: NavItem[] = [
  { label: "Request a quotation", href: "/rfq", available: true },
  { label: "Privacy", href: "/privacy", available: true },
];

/** The three business segments. Each links to its page once shipped (Aroma Chemicals), otherwise to its homepage section. */
export const segments = [
  {
    id: "fragrances",
    label: "Fragrances",
    anchor: "/#fragrances",
    items: ["Fine Fragrance", "Personal Care", "Air Care", "Fabric Care", "Home Care", "Incense and Bakhoor"],
  },
  {
    id: "aroma-chemicals",
    label: "Aroma Chemicals",
    anchor: "/aroma-chemicals",
    items: ["Custom manufacturing", "Process chemistry"],
  },
  {
    id: "flavours",
    label: "Flavours",
    anchor: "/#flavours",
    items: ["Confectionery", "Bakery", "Beverages", "Dairy", "Savoury"],
  },
] as const;
