import { APPLICATION_REFERENCE_PATTERN } from "@/features/careers/reference";

/*
 * Public careers URLs. Pure (no database), so the proxy, the sitemap, the pages
 * and the form can all import it. Like the other confirmation URLs, the
 * confirmation carries the reference only, never candidate data.
 */

export const CAREERS_PATH = "/careers";
export const CAREERS_APPLY_PATH = "/careers/apply";
export const CAREERS_CONFIRMATION_PATH = "/careers/apply/confirmation";

export function jobPath(slug: string): string {
  return `${CAREERS_PATH}/${encodeURIComponent(slug)}`;
}

/** The apply page, optionally preselecting an opening (re-validated on the server). */
export function applyHref(slug?: string): string {
  return slug ? `${CAREERS_APPLY_PATH}?job=${encodeURIComponent(slug)}` : CAREERS_APPLY_PATH;
}

export function applicationConfirmationHref(reference: string): string {
  return `${CAREERS_CONFIRMATION_PATH}?ref=${encodeURIComponent(reference)}`;
}

/** The `ref` search param if it is exactly one well-formed application reference (CA-YYYY-NNNNNN), else null. */
export function parseApplicationRef(value: string | string[] | undefined): string | null {
  return typeof value === "string" && APPLICATION_REFERENCE_PATTERN.test(value) ? value : null;
}

/** The `job` search param if it is a single plausible slug string (the server decides whether it is public). */
export function parseJobParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v !== "" && v.length <= 200 ? v : undefined;
}
