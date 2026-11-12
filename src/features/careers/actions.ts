"use server";

import { headers } from "next/headers";
import { processApplicationSubmission } from "@/features/careers/submit";
import type { SubmitRfqResult } from "@/features/enquiries/schema";

/**
 * Server action for the careers application form (FormData built by
 * applicationToFormData, or a plain <form>). Every value, including the job
 * slug, is re-validated on the server.
 */
export async function submitApplication(formData: FormData): Promise<SubmitRfqResult> {
  return processApplicationSubmission(formData, await headers());
}
