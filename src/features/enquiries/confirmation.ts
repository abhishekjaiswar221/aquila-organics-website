import { isReference } from "@/features/enquiries/reference";

export const RFQ_PATH = "/rfq";
export const CONFIRMATION_PATH = "/rfq/confirmation";

/** The confirmation URL carries the reference only, never business data. */
export function confirmationHref(reference: string): string {
  return `${CONFIRMATION_PATH}?ref=${encodeURIComponent(reference)}`;
}

/** The `ref` search param if it is exactly one well-formed reference (AQ-YYYY-NNNNNN), else null. */
export function parseConfirmationRef(value: string | string[] | undefined): string | null {
  return typeof value === "string" && isReference(value) ? value : null;
}
