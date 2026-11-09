"use server";

import { headers } from "next/headers";
import { MAX_ITEMS, type SubmitRfqResult } from "@/features/enquiries/schema";
import { processRfqSubmission } from "@/features/enquiries/submit";
import { getPublishedProductsByIds } from "@/features/products/queries";

/**
 * Server action for the RFQ form (FormData built by rfqToFormData, or a plain
 * <form>). Every value, including product ids, is re-validated on the server.
 */
export async function submitRfq(formData: FormData): Promise<SubmitRfqResult> {
  return processRfqSubmission(formData, await headers());
}

export type EnquiryProduct = { id: string; name: string; casNumber: string | null };

/**
 * Display details for the visitor's saved product ids: PUBLISHED products only
 * (getPublishedProductsByIds), name and CAS only. Unknown, draft and archived
 * ids are simply absent from the result.
 */
export async function getEnquiryProducts(ids: unknown): Promise<EnquiryProduct[]> {
  if (!Array.isArray(ids)) return [];
  const wanted = ids.filter((id): id is string => typeof id === "string").slice(0, MAX_ITEMS);
  const rows = await getPublishedProductsByIds(wanted);
  return rows.map((p) => ({ id: p.id, name: p.name, casNumber: p.casNumber }));
}
