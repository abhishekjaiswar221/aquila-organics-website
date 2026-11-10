import type { DefaultValues } from "react-hook-form";
import { contactToFormData, type ContactInput, type ContactType } from "@/features/contact/schema";

/**
 * Client-side form state for the Contact forms and its mapping to the
 * FormData submitContact parses (contactFromFormData). Isomorphic and pure.
 * Attachment helpers (ATTACHMENT_ACCEPT, checkSelectedFiles) are shared with
 * the RFQ form in enquiries/form-state.ts.
 */

/** React Hook Form values; consent may be false while unticked (contactSchema requires true). */
export type ContactFormValues = Omit<ContactInput, "consent"> & { consent: boolean };

/** Starting values for one segment's form, with an optional prefilled application slug. */
export function pristineContactValues(type: ContactType, application?: string): DefaultValues<ContactFormValues> {
  return {
    type,
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    country: "",
    application: application ?? "",
    message: "",
    consent: false,
  };
}

/** FormData for submitContact, with the form instance's idempotency token. */
export function buildContactFormData(
  values: ContactFormValues,
  submissionId: string,
  files: readonly File[],
): FormData {
  // Unticked consent is simply not sent (contactToFormData sends "on" only for true).
  const { consent, ...rest } = values;
  return contactToFormData({ ...rest, submissionId, ...(consent ? { consent: true } : {}) }, files);
}
