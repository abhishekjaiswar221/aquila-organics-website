import type { Metadata } from "next";
import { EnquiryConfirmation } from "@/components/pages/enquiry-confirmation";
import { parseConfirmationRef } from "@/features/enquiries/confirmation";

export const metadata: Metadata = {
  title: "Enquiry sent",
  description: "Confirmation of your request for quotation to Aquila Organics.",
  robots: { index: false, follow: false },
};

/*
 * Cache Components: reads searchParams on every request and renders the whole
 * response before sending it (no <Suspense>), the same documented pattern as
 * the catalogue list. `instant = false` declares that blocking is intended
 * and opts the route out of static-shell validation.
 *
 * The URL carries the reference only. It is checked against the reference
 * format and never echoed otherwise; nothing is looked up, so the page shows
 * no enquiry data.
 */
export const instant = false;

export default async function ConfirmationPage({ searchParams }: PageProps<"/rfq/confirmation">) {
  const reference = parseConfirmationRef((await searchParams).ref);
  return <EnquiryConfirmation kind="rfq" reference={reference} />;
}
