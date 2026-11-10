/**
 * Display rules for the admin enquiry page. A contact-form enquiry has no product lines and keeps
 * its text in the same field a quotation request uses for additional requirements; staff should
 * see it as the message it is, without an empty products table.
 */
export function enquiryMessageLabel(itemCount: number): "Message" | "Additional requirements" {
  return itemCount === 0 ? "Message" : "Additional requirements";
}

export function showProductsSection(itemCount: number): boolean {
  return itemCount > 0;
}
