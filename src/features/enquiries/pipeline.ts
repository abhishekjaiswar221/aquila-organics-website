import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma, type EnquiryType } from "@/generated/prisma/client";
import { validateAttachment } from "@/features/enquiries/attachment-rules";
import { parseRecipients, recipientsKey } from "@/features/enquiries/recipients";
import { generateReference } from "@/features/enquiries/reference";
import {
  ATTACHMENTS_FIELD,
  cleanLine,
  isHoneypotFilled,
  MAX_ATTACHMENTS,
  type SubmitRfqResult,
  type Unit,
} from "@/features/enquiries/schema";
import { getClientIp, hashIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { getEmailProvider } from "@/lib/email";
import { normaliseRecipientForLimit } from "@/lib/email-normalise";
import type { RenderedEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { dbRateLimitStore } from "@/lib/rate-limit-db";
import { getStorage } from "@/lib/storage";

/**
 * Shared steps of every public enquiry submission (the RFQ form in
 * enquiries/submit.ts and the Contact forms in contact/submit.ts). Each
 * caller runs them in the same order:
 *
 * parse -> checkHoneypot -> field validation (no DB, no file reading) ->
 * existingReference (submissionId replay) -> limitByIp ->
 * readAndValidateAttachments -> persistWithFiles(createEnquiry) ->
 * notifyAfterCreate (best effort; the acknowledgement capped per recipient
 * address, see RFQ_ACK_LIMIT). Honeypot hits, invalid fields and replays never
 * touch either limiter. Both forms share the per-IP and per-recipient buckets,
 * so switching forms does not buy an abuser a second quota.
 *
 * Files are written BEFORE the transaction and deleted again if it fails (or
 * loses a submissionId race), so a stored EnquiryAttachment row always points
 * at a file that exists. The worst case (the process dies between the two
 * steps) is an unreferenced file, never a dangling row.
 */

/** Per resolved client IP (salted hash), per window. */
export const RFQ_RATE_LIMIT = 5;
/**
 * Shared ceiling for every request whose client IP cannot be trusted (no
 * proxy header, or an appending proxy not listed in AUTH_TRUSTED_PROXIES).
 * Higher than the per-IP limit so one abuser cannot lock everyone out.
 */
export const RFQ_UNRESOLVED_IP_RATE_LIMIT = 100;
export const RFQ_RATE_WINDOW_MS = 60 * 60 * 1000;
/**
 * Acknowledgements per recipient address per window. The acknowledgement goes
 * to whatever address was typed, so without a cap the form could be used to
 * flood a third party's inbox. Over the cap the enquiry is still stored and
 * sales are still notified; only the acknowledgement is skipped.
 */
export const RFQ_ACK_LIMIT = 3;
export const RFQ_ACK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RFQ_EMAIL_TIMEOUT_MS = 8_000;
const NO_TRUSTED_IP = "no-trusted-ip";
const MAX_USER_AGENT = 200;
const REFERENCE_LOCK_NAMESPACE = 0x41510001;
const REFERENCE_ATTEMPTS = 3;

const RATE_LIMITED = "Too many requests. Please try again later.";
export const GENERIC_FAILURE = "We could not submit your enquiry. Please try again in a few minutes.";

/** Log prefix of the calling form, e.g. "rfq" or "contact". */
export type LogTag = string;

/** A product line to store; message-only enquiries have none. */
export type Line = {
  productId: string | null;
  name: string;
  cas: string | null;
  quantity: number;
  unit: Unit;
  notes: string | null;
};

export type Attachment = { safeName: string; mimeType: string; bytes: Uint8Array; key: string };

export function formError(message: string): SubmitRfqResult {
  return { ok: false, errors: { form: message } };
}

/** Error class (and Prisma code) only: messages can carry submitted values. */
export function errorClass(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `${err.name} ${err.code}`;
  if (err instanceof Error) return err.name;
  return typeof err;
}

/** Short, single-line error description with email addresses removed. */
function describeError(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : errorClass(err);
  return cleanLine(text.replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[address]")).slice(0, 200);
}

let warnedNoIp = false;
let emailTimeoutMs = RFQ_EMAIL_TIMEOUT_MS;

/** Test hooks only: shorten the email timeout, reset once-per-process state. */
export const rfqTesting = {
  setEmailTimeoutMs(ms: number) {
    emailTimeoutMs = ms;
  },
  emailTimeoutMs: () => emailTimeoutMs,
  reset() {
    warnedNoIp = false;
    emailTimeoutMs = RFQ_EMAIL_TIMEOUT_MS;
  },
};

class EmailTimeoutError extends Error {
  constructor(ms: number) {
    super(`Email send timed out after ${ms} ms`);
    this.name = "EmailTimeoutError";
  }
}

/** The provider has no AbortSignal support; a timed-out send is abandoned. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new EmailTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Limiter key for the acknowledgement cap: a salted SHA-256 of the address
 * normalised to one form per inbox (case, whitespace, +tags, Gmail dots and
 * googlemail.com), so variants share one quota. Neither the raw nor the
 * normalised address is stored in RateLimitHit.
 */
export function rfqAckLimitKey(email: string): string {
  const digest = createHash("sha256")
    .update(`${env.RATE_LIMIT_SALT}:rfq-ack:${normaliseRecipientForLimit(email)}`)
    .digest("hex");
  return `rfq-ack:${digest}`;
}

/** True when this recipient may get another acknowledgement (counts this one). */
async function ackAllowed(email: string): Promise<boolean> {
  const verdict = await checkRateLimit(dbRateLimitStore, rfqAckLimitKey(email), RFQ_ACK_LIMIT, RFQ_ACK_WINDOW_MS);
  return verdict.allowed;
}

function warnUnresolvedIpOnce(): void {
  if (warnedNoIp || process.env.NODE_ENV !== "production") return;
  if (env.AUTH_IP_HEADER || env.AUTH_TRUSTED_PROXIES?.length) return;
  warnedNoIp = true;
  console.warn(
    "[rfq] No trusted client IP: neither AUTH_IP_HEADER nor AUTH_TRUSTED_PROXIES is set and the request had no " +
      `single-address x-forwarded-for. All such RFQs use one shared rate-limit bucket of ${RFQ_UNRESOLVED_IP_RATE_LIMIT} ` +
      `per hour instead of a per-visitor limit of ${RFQ_RATE_LIMIT}, so heavy use from one source can ` +
      'block other visitors. See README "Deployment: reverse proxy and client IP".',
  );
}

export function fieldErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    const list = (out[key] ??= []);
    if (!list.includes(issue.message)) list.push(issue.message);
  }
  return out;
}

/**
 * Honeypot: a filled hidden field gets a result that looks like success (a
 * well-formed random reference), and nothing is stored, sent or counted.
 * Returns null when the field is empty.
 */
export function checkHoneypot(website: unknown): SubmitRfqResult | null {
  if (!isHoneypotFilled({ website: typeof website === "string" ? website : undefined })) return null;
  const reference = generateReference(new Date().getUTCFullYear(), randomInt(1, 1_000_000));
  return { ok: true, reference, droppedProducts: [], warnings: {} };
}

/** Reference of the enquiry already stored under this idempotency token, if any. */
export async function existingReference(submissionId: string | undefined): Promise<string | null> {
  if (!submissionId) return null;
  const found = await db.enquiry.findUnique({ where: { submissionId }, select: { reference: true } });
  return found?.reference ?? null;
}

/**
 * Per-IP submission limit (salted IP hash; one shared, higher bucket when the
 * client IP cannot be trusted). Counts this request.
 */
export async function limitByIp(
  requestHeaders: Headers,
): Promise<{ ok: true; ipHash: string | null } | { ok: false; result: SubmitRfqResult }> {
  const ip = getClientIp(requestHeaders);
  if (!ip) warnUnresolvedIpOnce();
  const ipHash = ip ? hashIp(ip, env.RATE_LIMIT_SALT) : null;
  const limit = await checkRateLimit(
    dbRateLimitStore,
    `rfq:${ipHash ?? NO_TRUSTED_IP}`,
    ipHash ? RFQ_RATE_LIMIT : RFQ_UNRESOLVED_IP_RATE_LIMIT,
    RFQ_RATE_WINDOW_MS,
  );
  if (!limit.allowed) return { ok: false, result: formError(RATE_LIMITED) };
  return { ok: true, ipHash };
}

function displayName(raw: string): string {
  const name = cleanLine(raw.split(/[\\/]/).pop() ?? "");
  return name ? [...name].slice(0, 80).join("") : "Unnamed file";
}

/** Reads and sniffs every attachment (validateAttachment); any bad file rejects the lot. */
export async function readAndValidateAttachments(
  formData: FormData,
): Promise<{ ok: true; files: Attachment[] } | { ok: false; errors: string[] }> {
  const entries = formData
    .getAll(ATTACHMENTS_FIELD)
    // An unused <input type="file"> submits an empty, unnamed part.
    .filter((v) => typeof v === "string" || v.size > 0 || v.name !== "");
  if (entries.length > MAX_ATTACHMENTS) {
    return { ok: false, errors: [`Attach no more than ${MAX_ATTACHMENTS} files`] };
  }
  const errors: string[] = [];
  const files: Attachment[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      errors.push("Attachments must be files");
      continue;
    }
    const bytes = new Uint8Array(await entry.arrayBuffer());
    const verdict = validateAttachment({ name: entry.name, size: entry.size, bytes });
    if (!verdict.ok) {
      errors.push(`${displayName(entry.name)}: ${verdict.reason}`);
      continue;
    }
    // Opaque random key: no user input, unguessable, valid for every driver.
    const key = `rfq-${randomBytes(32).toString("base64url")}`;
    files.push({ safeName: verdict.safeName, mimeType: verdict.mimeType, bytes, key });
  }
  return errors.length ? { ok: false, errors } : { ok: true, files };
}

async function removeFiles(keys: string[], tag: LogTag): Promise<void> {
  const storage = getStorage();
  await Promise.all(
    keys.map((key) =>
      storage.delete(key).catch((err: unknown) => {
        console.error(`[${tag}] could not remove an attachment after a failed submission:`, errorClass(err));
      }),
    ),
  );
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Everything stored for one enquiry. Text fields arrive already validated and cleaned. */
export type EnquiryDraft = {
  type: EnquiryType;
  submissionId?: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  country: string;
  businessSegment: string;
  intendedApplication?: string;
  additionalRequirements?: string;
  /** Activity detail `source`, e.g. "rfq-form" or "contact-form". */
  source: string;
  lines: Line[];
  files: Attachment[];
  ipHash: string | null;
  userAgent: string | null;
};

export type CreateOutcome =
  | { kind: "created"; id: string; reference: string }
  | { kind: "duplicate"; reference: string };

/**
 * Inside a transaction: takes the per-year advisory lock and returns the next
 * AQ-YYYY-NNNNNN reference. The lock is released at commit/rollback, after
 * which the next caller sees this row.
 */
export async function allocateReference(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const prefix = `AQ-${year}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REFERENCE_LOCK_NAMESPACE}::int, ${year}::int)`;
  const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
    SELECT COALESCE(MAX(substring("reference" FROM 9)::int), 0)::int AS max
    FROM "enquiry"
    WHERE "reference" LIKE ${`${prefix}%`} AND "reference" ~ '^AQ-[0-9]{4}-[0-9]{6}$'`;
  return generateReference(year, max + 1);
}

/** One transaction: enquiry, items, attachment rows and the creation activity. */
export async function createEnquiry(draft: EnquiryDraft): Promise<CreateOutcome> {
  try {
    return { kind: "created", ...(await insertEnquiry(draft)) };
  } catch (err) {
    // The unique index on submissionId arbitrates concurrent replays.
    if (isUniqueViolation(err)) {
      const reference = await existingReference(draft.submissionId);
      if (reference) return { kind: "duplicate", reference };
    }
    throw err;
  }
}

async function insertEnquiry(draft: EnquiryDraft): Promise<{ id: string; reference: string }> {
  const year = new Date().getUTCFullYear();
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const reference = await allocateReference(tx, year);
          return tx.enquiry.create({
            data: {
              reference,
              submissionId: draft.submissionId ?? null,
              type: draft.type,
              fullName: draft.fullName,
              companyName: draft.companyName,
              email: draft.email,
              phone: draft.phone,
              country: draft.country,
              businessSegment: draft.businessSegment,
              intendedApplication: draft.intendedApplication ?? null,
              additionalRequirements: draft.additionalRequirements ?? null,
              consentAt: new Date(),
              ipHash: draft.ipHash,
              userAgent: draft.userAgent,
              items: {
                create: draft.lines.map((l) => ({
                  productId: l.productId,
                  productNameSnapshot: l.name,
                  casSnapshot: l.cas,
                  quantity: new Prisma.Decimal(l.quantity.toFixed(3)),
                  unit: l.unit,
                  notes: l.notes,
                })),
              },
              attachments: {
                create: draft.files.map((f) => ({
                  filename: f.safeName,
                  mimeType: f.mimeType,
                  sizeBytes: f.bytes.length,
                  storageKey: f.key,
                })),
              },
              activities: {
                create: {
                  action: "enquiry.created",
                  detail: {
                    source: draft.source,
                    items: draft.lines.length,
                    catalogueItems: draft.lines.filter((l) => l.productId).length,
                    attachments: draft.files.length,
                  },
                },
              },
            },
            select: { id: true, reference: true },
          });
        },
        { maxWait: 10_000, timeout: 15_000 },
      );
    } catch (err) {
      // A reference clash is retried; a submissionId clash is not (a retry
      // would clash again) and is resolved by createEnquiry.
      if (
        attempt < REFERENCE_ATTEMPTS &&
        isUniqueViolation(err) &&
        !(await existingReference(draft.submissionId))
      ) {
        continue;
      }
      throw err;
    }
  }
}

/**
 * Writes the attachment files, then runs `create`. On failure, and when
 * `create` lost a submissionId race (the winner owns its own files), the files
 * written here are removed again.
 */
export async function persistWithFiles(
  files: Attachment[],
  create: () => Promise<CreateOutcome>,
  tag: LogTag,
): Promise<CreateOutcome> {
  const storage = getStorage();
  const written: string[] = [];
  let outcome: CreateOutcome;
  try {
    for (const file of files) {
      await storage.put(file.key, file.bytes, { mimeType: file.mimeType });
      written.push(file.key);
    }
    outcome = await create();
  } catch (err) {
    await removeFiles(written, tag);
    throw err;
  }
  if (outcome.kind === "duplicate") await removeFiles(written, tag);
  return outcome;
}

async function recordActivity(
  enquiryId: string,
  action: string,
  detail: Prisma.InputJsonObject,
  tag: LogTag,
): Promise<void> {
  try {
    await db.enquiryActivity.create({ data: { enquiryId, action, detail } });
  } catch (err) {
    console.error(`[${tag}] could not record ${action}:`, errorClass(err));
  }
}

// Shared with the admin enquiries warning (src/features/enquiries/recipients.ts).
async function recipientsFor(type: EnquiryType): Promise<string[]> {
  const setting = await db.siteSetting.findUnique({ where: { key: recipientsKey(type) } });
  return parseRecipients(setting?.value);
}

async function sendLogged(
  enquiryId: string,
  kind: "acknowledgement" | "internal",
  to: string[],
  message: RenderedEmail,
  tag: LogTag,
): Promise<void> {
  try {
    await withTimeout(getEmailProvider().send({ to, ...message }), emailTimeoutMs);
    await recordActivity(enquiryId, "email.sent", { kind, recipients: to.length }, tag);
  } catch (err) {
    console.error(`[${tag}] ${kind} email failed:`, describeError(err));
    await recordActivity(enquiryId, "email.failed", { kind, error: describeError(err) }, tag);
  }
}

export type Notification = {
  /** Routes the internal notification (SiteSetting recipients per type). */
  type: EnquiryType;
  /** The address the visitor typed; gets the acknowledgement if under its cap. */
  email: string;
  /** Must contain nothing the visitor typed. */
  acknowledgement: RenderedEmail;
  internal: RenderedEmail;
};

/**
 * The two emails are independent, so they run side by side: a slow or timed-out
 * acknowledgement no longer delays the internal notification (each has its own 8s
 * timeout). Each step logs its own failures and neither throws.
 */
async function notify(enquiry: { id: string; reference: string }, n: Notification, tag: LogTag): Promise<void> {
  await Promise.all([sendAcknowledgement(enquiry, n, tag), sendInternal(enquiry, n, tag)]);
}

async function sendAcknowledgement(
  enquiry: { id: string; reference: string },
  n: Notification,
  tag: LogTag,
): Promise<void> {
  // Per-recipient cap first. If the limiter itself fails, err on the side of
  // not sending (the enquiry is stored either way).
  let mayAcknowledge = false;
  let skipReason = "recipient limit";
  try {
    mayAcknowledge = await ackAllowed(n.email);
  } catch (err) {
    console.error(`[${tag}] acknowledgement limit check failed:`, errorClass(err));
    skipReason = "limit check failed";
  }
  if (mayAcknowledge) {
    await sendLogged(enquiry.id, "acknowledgement", [n.email], n.acknowledgement, tag);
  } else {
    console.warn(`[${tag}] acknowledgement skipped for ${enquiry.reference}: ${skipReason}`);
    await recordActivity(enquiry.id, "email.skipped", { reason: skipReason }, tag);
  }
}

async function sendInternal(
  enquiry: { id: string; reference: string },
  n: Notification,
  tag: LogTag,
): Promise<void> {
  let recipients: string[] = [];
  try {
    recipients = await recipientsFor(n.type);
  } catch (err) {
    console.error(`[${tag}] could not read notification recipients:`, errorClass(err));
  }
  if (recipients.length === 0) {
    console.warn(
      `[${tag}] no notification recipients configured for ${n.type}; internal email skipped for ${enquiry.reference}`,
    );
    await recordActivity(enquiry.id, "notification.skipped", { reason: "no recipients configured" }, tag);
    return;
  }
  await sendLogged(enquiry.id, "internal", recipients, n.internal, tag);
}

/** Best-effort emails after the enquiry is stored; never throws (a failing `build` included). */
export async function notifyAfterCreate(
  enquiry: { id: string; reference: string },
  build: () => Notification,
  tag: LogTag,
): Promise<void> {
  try {
    await notify(enquiry, build(), tag);
  } catch (err) {
    console.error(`[${tag}] notification step failed:`, errorClass(err));
  }
}

export function userAgentOf(headers: Headers): string | null {
  const ua = cleanLine(headers.get("user-agent") ?? "");
  return ua ? [...ua].slice(0, MAX_USER_AGENT).join("") : null;
}

/** Never throws; internal errors become one generic message. */
export async function guardSubmission(
  run: () => Promise<SubmitRfqResult>,
  tag: LogTag,
): Promise<SubmitRfqResult> {
  try {
    return await run();
  } catch (err) {
    console.error(`[${tag}] submission failed:`, errorClass(err));
    return formError(GENERIC_FAILURE);
  }
}
