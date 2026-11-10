import type { Metadata } from "next";
import { EnquiryConfirmation } from "@/components/pages/enquiry-confirmation";
import { parseConfirmationRef } from "@/features/enquiries/confirmation";

export const metadata: Metadata = {
  title: "Message sent",
  description: "Confirmation of your message to Aquila Organics.",
  robots: { index: false, follow: false },
};

/*
 * Same pattern as /rfq/confirmation: reads searchParams on every request
 * (`instant = false`), shows only a reference that matches the reference
 * format and never echoes anything else. The path, not the query, says that
 * this was a Contact message.
 */
export const instant = false;

export default async function ContactConfirmationPage({ searchParams }: PageProps<"/contact/confirmation">) {
  const reference = parseConfirmationRef((await searchParams).ref);
  return <EnquiryConfirmation kind="contact" reference={reference} />;
}
