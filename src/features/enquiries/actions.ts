"use server";

import { headers } from "next/headers";
import type { SubmitRfqResult } from "@/features/enquiries/schema";
import { processRfqSubmission } from "@/features/enquiries/submit";

/**
 * Server action for the RFQ form (FormData built by rfqToFormData, or a plain
 * <form>). Every value, including product ids, is re-validated on the server.
 */
export async function submitRfq(formData: FormData): Promise<SubmitRfqResult> {
  return processRfqSubmission(formData, await headers());
}
