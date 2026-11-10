import { contactApplication } from "@/features/contact/applications";
import { contactBusinessSegment, contactFromFormData, contactSchema } from "@/features/contact/schema";
import {
  checkHoneypot,
  createEnquiry,
  existingReference,
  fieldErrors,
  formError,
  GENERIC_FAILURE,
  guardSubmission,
  limitByIp,
  notifyAfterCreate,
  persistWithFiles,
  readAndValidateAttachments,
  userAgentOf,
  type EnquiryDraft,
} from "@/features/enquiries/pipeline";
import { rfqWarnings, type SubmitRfqResult } from "@/features/enquiries/schema";
import { TYPE_LABELS } from "@/features/enquiries/status";
import { internalMessageNotificationEmail, messageAcknowledgementEmail } from "@/lib/email/templates";

/**
 * Contact form submission (message-based, zero product lines), called by the
 * submitContact server action. Runs the shared pipeline steps in the same
 * order as the RFQ (see enquiries/pipeline.ts), sharing its per-IP and
 * per-recipient limits.
 */

const TAG = "contact";

async function submit(formData: FormData, requestHeaders: Headers): Promise<SubmitRfqResult> {
  if (!(formData instanceof FormData)) return formError(GENERIC_FAILURE);
  const raw = contactFromFormData(formData);

  const trap = checkHoneypot(raw.website);
  if (trap) return trap;

  // The type is only ever a validated CONTACT_TYPES value: an unknown or
  // privileged value (CAREERS, ADMIN) is a field error here, before any I/O.
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };
  const data = parsed.data;

  const replayed = await existingReference(data.submissionId);
  if (replayed) return { ok: true, reference: replayed, droppedProducts: [], warnings: {} };

  const limit = await limitByIp(requestHeaders);
  if (!limit.ok) return limit.result;

  const attachments = await readAndValidateAttachments(formData);
  if (!attachments.ok) return { ok: false, errors: { attachments: attachments.errors } };
  const files = attachments.files;

  const application = data.application ? contactApplication(data.type, data.application) : undefined;
  const draft: EnquiryDraft = {
    type: data.type,
    submissionId: data.submissionId,
    fullName: data.fullName,
    companyName: data.companyName,
    email: data.email,
    phone: data.phone,
    country: data.country,
    businessSegment: contactBusinessSegment(data.type),
    // The name from the fixed list, never the submitted text.
    intendedApplication: application?.name,
    additionalRequirements: data.message,
    source: "contact-form",
    lines: [],
    files,
    ipHash: limit.ipHash,
    userAgent: userAgentOf(requestHeaders),
  };

  const outcome = await persistWithFiles(files, () => createEnquiry(draft), TAG);
  if (outcome.kind === "duplicate") {
    return { ok: true, reference: outcome.reference, droppedProducts: [], warnings: {} };
  }
  const enquiry = { id: outcome.id, reference: outcome.reference };

  await notifyAfterCreate(
    enquiry,
    () => ({
      type: draft.type,
      email: data.email,
      acknowledgement: messageAcknowledgementEmail({ reference: enquiry.reference }),
      internal: internalMessageNotificationEmail({
        reference: enquiry.reference,
        enquiryType: TYPE_LABELS[data.type],
        fullName: data.fullName,
        company: data.companyName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        application: application?.name,
        message: data.message,
        attachmentNames: files.map((f) => f.safeName),
      }),
    }),
    TAG,
  );

  return { ok: true, reference: enquiry.reference, droppedProducts: [], warnings: rfqWarnings(data) };
}

/** Never throws; internal errors become one generic message. */
export async function processContactSubmission(
  formData: FormData,
  requestHeaders: Headers,
): Promise<SubmitRfqResult> {
  return guardSubmission(() => submit(formData, requestHeaders), TAG);
}
