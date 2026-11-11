import { randomInt } from "node:crypto";
import { applicationFromFormData, applicationSchema, CV_FIELD } from "@/features/careers/application-schema";
import { getPublishedJobBySlug } from "@/features/careers/job-queries";
import { allocateApplicationReference, generateApplicationReference } from "@/features/careers/reference";
import { recordAuditBestEffort } from "@/features/admin/audit";
import {
  checkHoneypot,
  fieldErrors,
  formError,
  GENERIC_FAILURE,
  guardSubmission,
  isUniqueViolation,
  limitByIp,
  notifyAfterCreate,
  persistWithFiles,
  readAndValidateAttachments,
  userAgentOf,
  type Attachment,
  type CreateOutcome,
} from "@/features/enquiries/pipeline";
import type { SubmitRfqResult } from "@/features/enquiries/schema";
import { db } from "@/lib/db";
import { careersAcknowledgementEmail, careersInternalEmail } from "@/lib/email/templates";

/**
 * Careers application submission, called by the submitApplication server
 * action. Same order of steps as the contact form (see enquiries/pipeline.ts):
 *
 * honeypot -> field validation -> submissionId replay -> per-IP limit (its own
 * "careers" bucket) -> CV validation -> job lookup -> store the CV object ->
 * one transaction (reference, application, file row) -> best-effort emails.
 *
 * The CV is written BEFORE the transaction and removed again if the transaction
 * fails or loses a submissionId race, so a stored ApplicationFile row always
 * points at an object that exists. Candidate data never reaches logs or the
 * audit log.
 */

const TAG = "careers";
const GENERAL_APPLICATION = "General application";
const CV_ALLOWED = ["pdf", "docx"] as const;
const REFERENCE_ATTEMPTS = 3;

async function existingApplicationReference(submissionId: string | undefined): Promise<string | null> {
  if (!submissionId) return null;
  const found = await db.jobApplication.findUnique({ where: { submissionId }, select: { reference: true } });
  return found?.reference ?? null;
}

type ApplicationDraft = {
  submissionId?: string;
  jobId: string | null;
  jobTitleSnapshot: string;
  fullName: string;
  email: string;
  phone?: string;
  country?: string;
  message?: string;
  cv: Attachment;
  ipHash: string | null;
  userAgent: string | null;
};

async function insertApplication(draft: ApplicationDraft): Promise<{ id: string; reference: string }> {
  const year = new Date().getUTCFullYear();
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const reference = await allocateApplicationReference(tx, year);
          return tx.jobApplication.create({
            data: {
              reference,
              submissionId: draft.submissionId ?? null,
              jobId: draft.jobId,
              jobTitleSnapshot: draft.jobTitleSnapshot,
              fullName: draft.fullName,
              email: draft.email,
              phone: draft.phone ?? null,
              country: draft.country ?? null,
              message: draft.message ?? null,
              consentAt: new Date(),
              ipHash: draft.ipHash,
              userAgent: draft.userAgent,
              files: {
                create: {
                  filename: draft.cv.safeName,
                  mimeType: draft.cv.mimeType,
                  sizeBytes: draft.cv.bytes.length,
                  storageKey: draft.cv.key,
                },
              },
            },
            select: { id: true, reference: true },
          });
        },
        { maxWait: 10_000, timeout: 15_000 },
      );
    } catch (err) {
      // A reference clash is retried; a submissionId clash is not (it would
      // clash again) and is resolved by createApplication.
      if (
        attempt < REFERENCE_ATTEMPTS &&
        isUniqueViolation(err) &&
        !(await existingApplicationReference(draft.submissionId))
      ) {
        continue;
      }
      throw err;
    }
  }
}

async function createApplication(draft: ApplicationDraft): Promise<CreateOutcome> {
  try {
    return { kind: "created", ...(await insertApplication(draft)) };
  } catch (err) {
    // The unique index on submissionId arbitrates concurrent replays.
    if (isUniqueViolation(err)) {
      const reference = await existingApplicationReference(draft.submissionId);
      if (reference) return { kind: "duplicate", reference };
    }
    throw err;
  }
}

/**
 * Email outcomes become AuditLog rows (best effort). Only the kind and a
 * recipient count are kept: never the error text, which could echo an address.
 */
function auditEmailOutcome(applicationId: string) {
  return async (action: string, detail: Record<string, string | number | boolean>): Promise<void> => {
    const kind = typeof detail.kind === "string" ? detail.kind : action;
    await recordAuditBestEffort({
      actorId: null,
      actorRole: "public",
      action: "application.email",
      entityType: "application",
      entityId: applicationId,
      outcome: action === "email.sent" ? "ok" : "rejected",
      detail: typeof detail.recipients === "number" ? { kind, recipients: detail.recipients } : { kind },
    });
  };
}

const ok = (reference: string): SubmitRfqResult => ({ ok: true, reference, droppedProducts: [], warnings: {} });

async function submit(formData: FormData, requestHeaders: Headers): Promise<SubmitRfqResult> {
  if (!(formData instanceof FormData)) return formError(GENERIC_FAILURE);
  const raw = applicationFromFormData(formData);

  // A bot gets a success-looking result; nothing is stored, sent or counted.
  if (checkHoneypot(raw.website)) {
    return ok(generateApplicationReference(new Date().getUTCFullYear(), randomInt(1, 1_000_000)));
  }

  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error.issues) };
  const data = parsed.data;

  const replayed = await existingApplicationReference(data.submissionId);
  if (replayed) return ok(replayed);

  const limit = await limitByIp(requestHeaders, "careers");
  if (!limit.ok) return limit.result;

  const attachments = await readAndValidateAttachments(formData, {
    field: CV_FIELD,
    allowed: CV_ALLOWED,
    max: 1,
    keyPrefix: "cv",
  });
  if (!attachments.ok) return { ok: false, errors: { [CV_FIELD]: attachments.errors } };
  if (attachments.files.length === 0) return { ok: false, errors: { [CV_FIELD]: ["Attach your CV"] } };
  const [cv] = attachments.files;

  // Only a currently public opening is ever stored; anything else (unknown,
  // draft, closed, expired) silently becomes a general application.
  const job = data.job ? await getPublishedJobBySlug(data.job, new Date()) : null;

  const draft: ApplicationDraft = {
    submissionId: data.submissionId,
    jobId: job?.id ?? null,
    jobTitleSnapshot: job?.title ?? GENERAL_APPLICATION,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    country: data.country,
    message: data.message,
    cv,
    ipHash: limit.ipHash,
    userAgent: userAgentOf(requestHeaders),
  };

  const outcome = await persistWithFiles([cv], () => createApplication(draft), TAG);
  if (outcome.kind === "duplicate") return ok(outcome.reference);
  const application = { id: outcome.id, reference: outcome.reference };

  await notifyAfterCreate(
    application,
    () => ({
      type: "CAREERS",
      email: data.email,
      acknowledgement: careersAcknowledgementEmail({ reference: application.reference }),
      internal: careersInternalEmail({
        reference: application.reference,
        jobTitle: draft.jobTitleSnapshot,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        message: data.message,
        cvName: cv.safeName,
      }),
    }),
    TAG,
    auditEmailOutcome(application.id),
  );

  return ok(application.reference);
}

/** Never throws; internal errors become one generic message. */
export async function processApplicationSubmission(
  formData: FormData,
  requestHeaders: Headers,
): Promise<SubmitRfqResult> {
  return guardSubmission(() => submit(formData, requestHeaders), TAG);
}
