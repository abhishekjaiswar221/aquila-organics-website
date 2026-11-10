import { contacts } from "./site";
import type { Block } from "./types";

/** Verified contact details only. Named individuals stay hidden until consent is confirmed. */

export interface ContactChannel {
  label: string;
  email: string;
}

export interface PhoneLine {
  label: string;
  display: string;
  tel: string;
}

export const contactMeta = {
  title: "Contact",
  lead: "Tell us what you are developing, and our team will respond.",
  description: "Contact Aquila Organics about fragrances, aroma chemicals and flavours.",
} as const;

export const contactChannels: Block<ContactChannel>[] = [
  { id: "channel-general", status: "verified", data: { label: "General enquiries", email: contacts.general } },
  { id: "channel-sales", status: "verified", data: { label: "Sales (aroma chemicals)", email: contacts.sales } },
  { id: "channel-fragrances", status: "verified", data: { label: "Fragrances", email: contacts.fragrances } },
  // Spelled "flavors@" on the live site; the client must confirm the mailbox before it is used.
  {
    id: "channel-flavours",
    status: "needs-client-confirmation",
    data: { label: "Flavours", email: contacts.flavours },
  },
  { id: "channel-hr", status: "verified", data: { label: "Careers (HR)", email: contacts.hr } },
];

export const contactPhones: Block<PhoneLine>[] = [
  {
    id: "phone-aroma-chemicals",
    status: "verified",
    data: { label: "Aroma chemicals", ...contacts.phoneAromaChemicals },
  },
  {
    id: "phone-fragrances-flavours",
    status: "verified",
    data: { label: "Fragrances and flavours", ...contacts.phoneFragrancesFlavours },
  },
];

export const contactHours: Block<string> = { id: "contact-hours", status: "verified", data: contacts.hours };

/** Named on the live contact page; never rendered until each person consents. */
export const hiddenContacts: Block<{ name: string; area: string }>[] = [
  { id: "person-flavours-fragrances", status: "hidden", data: { name: "Shalin Kale", area: "Flavours and fragrances" } },
  { id: "person-aroma-chemicals", status: "hidden", data: { name: "Sunil Patil", area: "Aroma chemicals" } },
];
