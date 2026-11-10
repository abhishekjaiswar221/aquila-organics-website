import type { EnquiryType } from "@/generated/prisma/client";
import { getPublishedProductsByIds } from "@/features/products/queries";
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
  type Line,
} from "@/features/enquiries/pipeline";
import {
  rfqFromFormData,
  rfqSchema,
  rfqWarnings,
  UNIT_LABELS,
  type BusinessSegment,
  type RfqData,
  type SubmitRfqResult,
} from "@/features/enquiries/schema";
import { acknowledgementEmail, internalNotificationEmail, type EmailItem } from "@/lib/email/templates";

/**
 * RFQ submission, called by the submitRfq server action (actions.ts).
 *
 * The guards, storage, reference allocation and emails are the shared steps
 * in pipeline.ts (see the order documented there). Specific to the RFQ:
 * product lines are resolved against PUBLISHED products only, and the enquiry
 * type is derived from the lines and the visitor's segment.
 */

export {
  RFQ_ACK_LIMIT,
  RFQ_ACK_WINDOW_MS,
  RFQ_EMAIL_TIMEOUT_MS,
  RFQ_RATE_LIMIT,
  RFQ_RATE_WINDOW_MS,
  RFQ_UNRESOLVED_IP_RATE_LIMIT,
  rfqAckLimitKey,
  rfqTesting,
} from "@/features/enquiries/pipeline";

const TAG = "rfq";

/** The enquiry type routes the internal notification. */
export function deriveEnquiryType(segment: BusinessSegment, allCatalogueProducts: boolean): EnquiryType {
  // The catalogue holds aroma chemicals, so a list of only catalogue products
  // is an aroma chemicals enquiry whatever the visitor's own segment.
  if (allCatalogueProducts) return "AROMA_CHEMICALS";
  switch (segment) {
    case "FRAGRANCES":
      return "FRAGRANCES";
    case "AROMA_CHEMICALS":
      return "AROMA_CHEMICALS";
    case "FLAVOURS":
      return "FLAVOURS";
    default:
      return "GENERAL";
  }
}

async function resolveLines(items: RfqData["items"]): Promise<{ lines: Line[]; dropped: string[] }> {
  const ids = items.flatMap((i) => (i.productId ? [i.productId] : []));
  const published = new Map((await getPublishedProductsByIds(ids)).map((p) => [p.id, p]));
  const dropped: string[] = [];
  const lines = items.map((item): Line => {
    const product = item.productId ? published.get(item.productId) : undefined;
    if (item.productId && !product) dropped.push(item.name);
    return {
      productId: product?.id ?? null,
      // Snapshots come from the database, never from the client.
      name: product?.name ?? item.name,
      cas: product?.casNumber ?? null,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes ?? null,
    };
  });
  return { lines, dropped };
}

async function submit(formData: FormData, requestHeaders: Headers): Promise<SubmitRfqResult> {
  if (!(formData instanceof FormData)) return formError(GENERIC_FAILURE);
  const raw = rfqFromFormData(formData);

  const trap = checkHoneypot(raw.website);
  if (trap) return trap;

  // Cheap, synchronous field validation first: junk never consumes the limiter.
  const parsed = rfqSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };
  const data = parsed.data;

  // Replay of an already-stored submission: return only its reference. The
  // token is a random uuid known only to the visitor's own form, so it cannot
  // be guessed to probe someone else's enquiry, and nothing else is disclosed.
  const replayed = await existingReference(data.submissionId);
  if (replayed) return { ok: true, reference: replayed, droppedProducts: [], warnings: {} };

  const limit = await limitByIp(requestHeaders);
  if (!limit.ok) return limit.result;

  const attachments = await readAndValidateAttachments(formData);
  if (!attachments.ok) return { ok: false, errors: { attachments: attachments.errors } };
  const files = attachments.files;

  const { lines, dropped } = await resolveLines(data.items);
  const draft: EnquiryDraft = {
    type: deriveEnquiryType(data.businessSegment, lines.every((l) => l.productId !== null)),
    submissionId: data.submissionId,
    fullName: data.fullName,
    companyName: data.companyName,
    email: data.email,
    phone: data.phone,
    country: data.country,
    businessSegment: data.businessSegment,
    intendedApplication: data.intendedApplication,
    additionalRequirements: data.additionalRequirements,
    source: "rfq-form",
    lines,
    files,
    ipHash: limit.ipHash,
    userAgent: userAgentOf(requestHeaders),
  };

  const outcome = await persistWithFiles(files, () => createEnquiry(draft), TAG);
  // Lost a concurrent replay race: the winner owns the enquiry and emails.
  if (outcome.kind === "duplicate") {
    return { ok: true, reference: outcome.reference, droppedProducts: [], warnings: {} };
  }
  const enquiry = { id: outcome.id, reference: outcome.reference };

  await notifyAfterCreate(
    enquiry,
    () => {
      const items: EmailItem[] = lines.map((l) => ({
        name: l.name,
        quantity: String(l.quantity),
        unit: UNIT_LABELS[l.unit],
        notes: l.notes ?? undefined,
      }));
      return {
        type: draft.type,
        email: data.email,
        acknowledgement: acknowledgementEmail({ reference: enquiry.reference, lineCount: lines.length }),
        internal: internalNotificationEmail({
          reference: enquiry.reference,
          fullName: data.fullName,
          items,
          company: data.companyName,
          email: data.email,
          phone: data.phone,
          country: data.country,
          businessSegment: data.businessSegment,
          application: data.intendedApplication,
          notes: data.additionalRequirements,
          attachmentNames: files.map((f) => f.safeName),
        }),
      };
    },
    TAG,
  );

  return {
    ok: true,
    reference: enquiry.reference,
    droppedProducts: dropped,
    warnings: rfqWarnings(data),
  };
}

/** Never throws; internal errors become one generic message. */
export async function processRfqSubmission(
  formData: FormData,
  requestHeaders: Headers,
): Promise<SubmitRfqResult> {
  return guardSubmission(() => submit(formData, requestHeaders), TAG);
}
