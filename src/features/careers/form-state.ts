import type { DefaultValues } from "react-hook-form";
import {
  APPLICATION_FIELDS,
  CV_FIELD,
  type ApplicationInput,
} from "@/features/careers/application-schema";

/**
 * Client-side form state for the careers application form and its mapping to
 * the FormData submitApplication parses (applicationFromFormData). Isomorphic
 * and pure.
 */

export { APPLICATION_FIELDS, CV_FIELD, JOB_FIELD } from "@/features/careers/application-schema";

/** CV types the form offers; the server check (extension and content) is authoritative. */
export const CV_ACCEPT = ".pdf,.docx";
export const CV_ALLOWED_EXTENSIONS = ["pdf", "docx"] as const;

/** React Hook Form values; consent may be false while unticked (applicationSchema requires true). */
export type ApplicationFormValues = Omit<ApplicationInput, "consent"> & { consent: boolean };

/** Starting values, with an optional prefilled opening slug. */
export function pristineApplicationValues(job?: string): DefaultValues<ApplicationFormValues> {
  return { fullName: "", email: "", phone: "", country: "", message: "", job: job ?? "", consent: false };
}

/** Builds the FormData that submitApplication expects, with the single CV file. */
export function applicationToFormData(values: Partial<ApplicationInput>, cv?: File | null): FormData {
  const fd = new FormData();
  for (const field of APPLICATION_FIELDS) {
    const v = values[field];
    if (typeof v === "string") fd.set(field, v);
  }
  // Unticked consent is simply not sent.
  if (values.consent === true) fd.set("consent", "on");
  if (cv) fd.set(CV_FIELD, cv);
  return fd;
}

/** FormData with the form instance's idempotency token. */
export function buildApplicationFormData(
  values: ApplicationFormValues,
  submissionId: string,
  cv: File | null,
): FormData {
  const { consent, ...rest } = values;
  return applicationToFormData({ ...rest, submissionId, ...(consent ? { consent: true } : {}) }, cv);
}

/** Client-side hint only: the extension of the chosen file. Returns an error message or null. */
export function checkSelectedCv(file: { name: string; size: number } | null | undefined): string | null {
  if (!file) return "Attach your CV";
  if (file.size === 0) return "File is empty";
  if (file.size > 10 * 1024 * 1024) return "File is larger than 10 MB";
  const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  if (!file.name.includes(".") || !(CV_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Your CV must be a PDF or DOCX file";
  }
  return null;
}
