export const CONTACT_PATH = "/contact";
export const CONTACT_CONFIRMATION_PATH = "/contact/confirmation";

/**
 * Where a sent Contact message lands. Like the RFQ confirmation, the URL
 * carries the reference only, never business data; the path alone says that
 * this was a message rather than a quotation request.
 */
export function contactConfirmationHref(reference: string): string {
  return `${CONTACT_CONFIRMATION_PATH}?ref=${encodeURIComponent(reference)}`;
}
