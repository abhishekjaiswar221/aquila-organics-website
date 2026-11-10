"use server";

import { headers } from "next/headers";
import { processContactSubmission } from "@/features/contact/submit";
import type { SubmitRfqResult } from "@/features/enquiries/schema";

/**
 * Server action for the Contact forms (FormData built by contactToFormData,
 * or a plain <form>). Every value, including the enquiry type, is
 * re-validated on the server.
 */
export async function submitContact(formData: FormData): Promise<SubmitRfqResult> {
  return processContactSubmission(formData, await headers());
}
