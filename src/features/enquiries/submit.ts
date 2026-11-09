import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma, type EnquiryType } from "@/generated/prisma/client";
import { getPublishedProductsByIds } from "@/features/products/queries";
import { validateAttachment } from "@/features/enquiries/attachment-rules";
import { generateReference } from "@/features/enquiries/reference";
import {
  ATTACHMENTS_FIELD,
  cleanLine,
  isHoneypotFilled,
  MAX_ATTACHMENTS,
  rfqFromFormData,
  rfqSchema,
  rfqWarnings,
  UNIT_LABELS,
  type BusinessSegment,
  type RfqData,
  type SubmitRfqResult,
  type Unit,
} from "@/features/enquiries/schema";
import { getClientIp, hashIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { getEmailProvider } from "@/lib/email";
import { acknowledgementEmail, internalNotificationEmail, type EmailItem } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { dbRateLimitStore } from "@/lib/rate-limit-db";
import { getStorage } from "@/lib/storage";

/**
 * RFQ submission, called by the submitRfq server action (actions.ts).
 *
 * Order: parse -> honeypot -> rate limit -> validate fields and attachments ->
 * resolve product lines (published only) -> write attachment files -> one
 * transaction for enquiry, items, attachment rows and the creation activity
 * -> best-effort emails.
 *
 * Files are written BEFORE the transaction and deleted again if it fails, so a
 * stored EnquiryAttachment row always points at a file that exists. The worst
 * case (the process dies between the two steps) is an unreferenced file, never
 * a dangling row.
 */

export const RFQ_RATE_LIMIT = 5;
export const RFQ_RATE_WINDOW_MS = 60 * 60 * 1000;
const NO_TRUSTED_IP = "no-trusted-ip";
const MAX_USER_AGENT = 200;
const MAX_RECIPIENTS = 20;
const REFERENCE_LOCK_NAMESPACE = 0x41510001;
const REFERENCE_ATTEMPTS = 3;

const RATE_LIMITED = "Too many requests. Please try again later.";
const GENERIC_FAILURE = "We could not submit your enquiry. Please try again in a few minutes.";

type Line = {
  productId: string | null;
  name: string;
  cas: string | null;
  quantity: number;
  unit: Unit;
  notes: string | null;
};

type Attachment = { safeName: string; mimeType: string; bytes: Uint8Array; key: string };

function formError(message: string): SubmitRfqResult {
  return { ok: false, errors: { form: message } };
}

/** Error class (and Prisma code) only: messages can carry submitted values. */
function errorClass(err: unknown): string {
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

function fieldErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    const list = (out[key] ??= []);
    if (!list.includes(issue.message)) list.push(issue.message);
  }
  return out;
}

function displayName(raw: string): string {
  const name = cleanLine(raw.split(/[\\/]/).pop() ?? "");
  return name ? [...name].slice(0, 80).join("") : "Unnamed file";
}

async function readAttachments(
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

async function removeFiles(keys: string[]): Promise<void> {
  const storage = getStorage();
  await Promise.all(
    keys.map((key) =>
      storage.delete(key).catch((err: unknown) => {
        console.error("[rfq] could not remove an attachment after a failed submission:", errorClass(err));
      }),
    ),
  );
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

type EnquiryRecord = {
  type: EnquiryType;
  data: RfqData;
  lines: Line[];
  files: Attachment[];
  ipHash: string | null;
  userAgent: string | null;
};

async function createEnquiry(record: EnquiryRecord): Promise<{ id: string; reference: string }> {
  const year = new Date().getUTCFullYear();
  const prefix = `AQ-${year}-`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          // Serialise reference allocation per year; the lock is released at
          // commit/rollback, after which the next caller sees this row.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REFERENCE_LOCK_NAMESPACE}::int, ${year}::int)`;
          const [{ max }] = await tx.$queryRaw<{ max: number }[]>`
            SELECT COALESCE(MAX(substring("reference" FROM 9)::int), 0)::int AS max
            FROM "enquiry"
            WHERE "reference" LIKE ${`${prefix}%`} AND "reference" ~ '^AQ-[0-9]{4}-[0-9]{6}$'`;
          const reference = generateReference(year, max + 1);
          const { data } = record;
          return tx.enquiry.create({
            data: {
              reference,
              type: record.type,
              fullName: data.fullName,
              companyName: data.companyName,
              email: data.email,
              phone: data.phone,
              country: data.country,
              businessSegment: data.businessSegment,
              intendedApplication: data.intendedApplication ?? null,
              additionalRequirements: data.additionalRequirements ?? null,
              consentAt: new Date(),
              ipHash: record.ipHash,
              userAgent: record.userAgent,
              items: {
                create: record.lines.map((l) => ({
                  productId: l.productId,
                  productNameSnapshot: l.name,
                  casSnapshot: l.cas,
                  quantity: new Prisma.Decimal(l.quantity.toFixed(3)),
                  unit: l.unit,
                  notes: l.notes,
                })),
              },
              attachments: {
                create: record.files.map((f) => ({
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
                    source: "rfq-form",
                    items: record.lines.length,
                    catalogueItems: record.lines.filter((l) => l.productId).length,
                    attachments: record.files.length,
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
      if (attempt < REFERENCE_ATTEMPTS && isUniqueViolation(err)) continue;
      throw err;
    }
  }
}

async function recordActivity(enquiryId: string, action: string, detail: Prisma.InputJsonObject): Promise<void> {
  try {
    await db.enquiryActivity.create({ data: { enquiryId, action, detail } });
  } catch (err) {
    console.error(`[rfq] could not record ${action}:`, errorClass(err));
  }
}

async function recipientsFor(type: EnquiryType): Promise<string[]> {
  const setting = await db.siteSetting.findUnique({ where: { key: `notification.recipients.${type}` } });
  const value = setting?.value;
  if (!Array.isArray(value)) return [];
  const email = z.email();
  const out = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const address = entry.trim().toLowerCase();
    if (email.safeParse(address).success) out.add(address);
    if (out.size >= MAX_RECIPIENTS) break;
  }
  return [...out];
}

async function sendLogged(
  enquiryId: string,
  kind: "acknowledgement" | "internal",
  to: string[],
  message: { subject: string; html: string; text: string },
): Promise<void> {
  try {
    await getEmailProvider().send({ to, ...message });
    await recordActivity(enquiryId, "email.sent", { kind, recipients: to.length });
  } catch (err) {
    console.error(`[rfq] ${kind} email failed:`, describeError(err));
    await recordActivity(enquiryId, "email.failed", { kind, error: describeError(err) });
  }
}

async function notify(
  enquiry: { id: string; reference: string },
  record: EnquiryRecord,
): Promise<void> {
  const { data } = record;
  const items: EmailItem[] = record.lines.map((l) => ({
    name: l.name,
    quantity: String(l.quantity),
    unit: UNIT_LABELS[l.unit],
  }));
  await sendLogged(
    enquiry.id,
    "acknowledgement",
    [data.email],
    acknowledgementEmail({ reference: enquiry.reference, fullName: data.fullName, items }),
  );

  let recipients: string[] = [];
  try {
    recipients = await recipientsFor(record.type);
  } catch (err) {
    console.error("[rfq] could not read notification recipients:", errorClass(err));
  }
  if (recipients.length === 0) {
    console.warn(
      `[rfq] no notification recipients configured for ${record.type}; internal email skipped for ${enquiry.reference}`,
    );
    await recordActivity(enquiry.id, "notification.skipped", { reason: "no recipients configured" });
    return;
  }
  await sendLogged(
    enquiry.id,
    "internal",
    recipients,
    internalNotificationEmail({
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
      attachmentNames: record.files.map((f) => f.safeName),
    }),
  );
}

function userAgentOf(headers: Headers): string | null {
  const ua = cleanLine(headers.get("user-agent") ?? "");
  return ua ? [...ua].slice(0, MAX_USER_AGENT).join("") : null;
}

async function submit(formData: FormData, requestHeaders: Headers): Promise<SubmitRfqResult> {
  if (!(formData instanceof FormData)) return formError(GENERIC_FAILURE);
  const raw = rfqFromFormData(formData);

  // Honeypot: look like success, store nothing, send nothing, count nothing.
  if (isHoneypotFilled({ website: typeof raw.website === "string" ? raw.website : undefined })) {
    const reference = generateReference(new Date().getUTCFullYear(), randomInt(1, 1_000_000));
    return { ok: true, reference, droppedProducts: [], warnings: {} };
  }

  const ip = getClientIp(requestHeaders);
  if (!ip && !warnedNoIp) {
    warnedNoIp = true;
    console.warn(
      "[rfq] no trusted client IP; RFQ rate limiting falls back to one shared bucket. " +
        'See README "Deployment: reverse proxy and client IP".',
    );
  }
  const ipHash = ip ? hashIp(ip, env.RATE_LIMIT_SALT) : null;
  const limit = await checkRateLimit(
    dbRateLimitStore,
    `rfq:${ipHash ?? NO_TRUSTED_IP}`,
    RFQ_RATE_LIMIT,
    RFQ_RATE_WINDOW_MS,
  );
  if (!limit.allowed) return formError(RATE_LIMITED);

  const parsed = rfqSchema.safeParse(raw);
  const attachments = await readAttachments(formData);
  if (!parsed.success || !attachments.ok) {
    const errors = parsed.success ? {} : fieldErrors(parsed.error.issues);
    if (!attachments.ok) errors.attachments = attachments.errors;
    return { ok: false, errors };
  }
  const data = parsed.data;
  const files = attachments.files;

  const { lines, dropped } = await resolveLines(data.items);
  const record: EnquiryRecord = {
    type: deriveEnquiryType(data.businessSegment, lines.every((l) => l.productId !== null)),
    data,
    lines,
    files,
    ipHash,
    userAgent: userAgentOf(requestHeaders),
  };

  const storage = getStorage();
  const written: string[] = [];
  let enquiry: { id: string; reference: string };
  try {
    for (const file of files) {
      await storage.put(file.key, file.bytes, { mimeType: file.mimeType });
      written.push(file.key);
    }
    enquiry = await createEnquiry(record);
  } catch (err) {
    await removeFiles(written);
    throw err;
  }

  try {
    await notify(enquiry, record);
  } catch (err) {
    console.error("[rfq] notification step failed:", errorClass(err));
  }

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
  try {
    return await submit(formData, requestHeaders);
  } catch (err) {
    console.error("[rfq] submission failed:", errorClass(err));
    return formError(GENERIC_FAILURE);
  }
}
