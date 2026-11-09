import type { EnquiryStatus, EnquiryType } from "@/generated/prisma/enums";

export type { EnquiryStatus, EnquiryType };

/** Every enquiry status, in workflow order. */
export const ENQUIRY_STATUSES = [
  "NEW",
  "ASSIGNED",
  "CONTACTED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const satisfies readonly EnquiryStatus[];

export const STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  QUOTATION_SENT: "Quotation sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const ENQUIRY_TYPES = [
  "FRAGRANCES",
  "AROMA_CHEMICALS",
  "FLAVOURS",
  "GENERAL",
  "CAREERS",
] as const satisfies readonly EnquiryType[];

export const TYPE_LABELS: Record<EnquiryType, string> = {
  FRAGRANCES: "Fragrances",
  AROMA_CHEMICALS: "Aroma chemicals",
  FLAVOURS: "Flavours",
  GENERAL: "General",
  CAREERS: "Careers",
};

export function isEnquiryStatus(value: unknown): value is EnquiryStatus {
  return typeof value === "string" && (ENQUIRY_STATUSES as readonly string[]).includes(value);
}
