import { z } from "zod";

/**
 * The RFQ form schema, shared by the client form (React Hook Form) and the
 * server action, which validates again. Isomorphic: imports nothing server-only.
 *
 * Text rule: every string is trimmed and stripped of control and invisible
 * characters (single-line fields also fold line breaks into spaces). The
 * length limit applies to the cleaned value, and over-long text is REJECTED
 * with a field error rather than silently truncated.
 */

export const BUSINESS_SEGMENTS = ["FRAGRANCES", "AROMA_CHEMICALS", "FLAVOURS", "OTHER"] as const;
export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number];
export const BUSINESS_SEGMENT_LABELS: Record<BusinessSegment, string> = {
  FRAGRANCES: "Fragrances",
  AROMA_CHEMICALS: "Aroma chemicals",
  FLAVOURS: "Flavours",
  OTHER: "Other",
};

export const UNITS = ["KG", "G", "MT", "L", "ML", "OTHER"] as const;
export type Unit = (typeof UNITS)[number];
export const UNIT_LABELS: Record<Unit, string> = {
  KG: "kg",
  G: "g",
  MT: "metric tonnes",
  L: "litres",
  ML: "ml",
  OTHER: "other (see notes)",
};

export const MAX_ITEMS = 25;
export const MAX_ATTACHMENTS = 5;
/** Fits Decimal(14, 3) with a wide margin. */
export const MAX_QUANTITY = 10_000_000;

export const TEXT_LIMITS = {
  fullName: 120,
  companyName: 160,
  email: 254,
  phone: 40,
  country: 80,
  intendedApplication: 500,
  additionalRequirements: 2000,
  itemName: 200,
  itemNotes: 500,
} as const;

/** Form field names used by rfqToFormData / rfqFromFormData. */
export const ATTACHMENTS_FIELD = "attachments";
export const HONEYPOT_FIELD = "website";

const LINE_BREAKS = new RegExp("\r\n|[\n\r\u000B\u000C\u0085\u2028\u2029]", "g");
// C0/C1 controls (tab and LF handled separately), bidi overrides, zero-width
// characters and the BOM.
const INVISIBLE = new RegExp(
  "[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]",
  "g",
);

/** Single-line text: no control characters, whitespace runs folded to one space. */
export function cleanLine(value: string): string {
  return value.replace(LINE_BREAKS, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** Multi-line text: keeps line breaks (as \n) and tabs, drops other controls. */
export function cleanMultiline(value: string): string {
  return value
    .replace(LINE_BREAKS, "\n")
    .replace(INVISIBLE, "")
    .replace(/[^\S\n\t]+/g, " ")
    .trim();
}

function requiredLine(label: string, max: number) {
  return z
    .string({ error: `${label} is required` })
    .transform(cleanLine)
    .pipe(
      z
        .string()
        .min(1, { error: `${label} is required`, abort: true })
        .max(max, { error: `${label} must be at most ${max} characters` }),
    );
}

function optionalText(label: string, max: number) {
  return z
    .string()
    .optional()
    .transform((v) => (v === undefined ? "" : cleanMultiline(v)))
    .pipe(z.string().max(max, { error: `${label} must be at most ${max} characters` }))
    .transform((v) => (v === "" ? undefined : v));
}

const PHONE_CHARS = /^[0-9+()\-./\s#xX]+$/;

const quantity = z
  .union([z.number(), z.string()], { error: "Enter a quantity" })
  .transform((v) => {
    if (typeof v === "number") return v;
    const t = v.trim();
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
  })
  .pipe(
    z
      .number({ error: "Enter a quantity as a number" })
      .positive({ error: "Quantity must be greater than zero" })
      .max(MAX_QUANTITY, { error: `Quantity must be at most ${MAX_QUANTITY.toLocaleString("en-GB")}` })
      .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, {
        error: "Use at most three decimal places",
      }),
  );

export const rfqItemSchema = z.object({
  productId: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim().toLowerCase() || undefined))
    .pipe(z.uuid({ error: "Unknown product" }).optional()),
  name: requiredLine("Product name", TEXT_LIMITS.itemName),
  quantity,
  unit: z.enum(UNITS, { error: "Choose a unit" }),
  notes: optionalText("Notes", TEXT_LIMITS.itemNotes),
});

export const rfqSchema = z.object({
  fullName: requiredLine("Full name", TEXT_LIMITS.fullName),
  companyName: requiredLine("Company name", TEXT_LIMITS.companyName),
  email: z
    .string({ error: "Email is required" })
    .transform(cleanLine)
    .pipe(
      z
        .email({ error: "Enter a valid email address" })
        .max(TEXT_LIMITS.email, { error: "Enter a valid email address" }),
    ),
  phone: requiredLine("Telephone", TEXT_LIMITS.phone)
    .refine((v) => PHONE_CHARS.test(v), { error: "Enter a valid telephone number" })
    .refine((v) => (v.match(/\d/g) ?? []).length >= 5, { error: "Enter a valid telephone number" }),
  country: requiredLine("Country", TEXT_LIMITS.country),
  businessSegment: z.enum(BUSINESS_SEGMENTS, { error: "Choose a business segment" }),
  intendedApplication: optionalText("Intended application", TEXT_LIMITS.intendedApplication),
  additionalRequirements: optionalText("Additional requirements", TEXT_LIMITS.additionalRequirements),
  consent: z.literal(true, { error: "Please agree to the privacy notice to continue" }),
  /**
   * Idempotency token: one random uuid per form instance (crypto.randomUUID()).
   * Re-posting the same token returns the original reference.
   */
  submissionId: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim().toLowerCase() || undefined))
    .pipe(z.uuid({ error: "Invalid submission, please reload the page" }).optional()),
  /** Honeypot: hidden from people; a bot that fills it is "accepted" and discarded. */
  website: z.string().optional(),
  items: z
    .array(rfqItemSchema, { error: "Add at least one product" })
    .min(1, { error: "Add at least one product" })
    .max(MAX_ITEMS, { error: `Add no more than ${MAX_ITEMS} products` }),
});

export type RfqInput = z.input<typeof rfqSchema>;
export type RfqData = z.output<typeof rfqSchema>;
export type RfqItemData = z.output<typeof rfqItemSchema>;

/**
 * What submitRfq returns to the browser. Never carries internal fields (ids,
 * IP hash, user agent, storage keys) or internal error text.
 */
export type SubmitRfqResult =
  | {
      ok: true;
      reference: string;
      /** Names of lines whose product is no longer available; kept as free text. */
      droppedProducts: string[];
      /** Non-blocking hints keyed by field, e.g. a personal email address. */
      warnings: Record<string, string>;
    }
  | { ok: false; errors: Record<string, string[]> | { form: string } };

export function isHoneypotFilled(data: { website?: string | null }): boolean {
  return typeof data.website === "string" && data.website.trim() !== "";
}

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "ymail.com",
  "rocketmail.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "rediffmail.com",
  "qq.com",
  "163.com",
  "126.com",
  "web.de",
  "tutanota.com",
]);
// Providers with many country domains (yahoo.co.uk, hotmail.fr, live.in ...).
const FREE_MAIL_FAMILIES = /^(yahoo|hotmail|outlook|live)(\.[a-z]{2,})+$/;

export function isFreeMailAddress(email: string): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return FREE_MAIL_DOMAINS.has(domain) || FREE_MAIL_FAMILIES.test(domain);
}

/** Non-blocking hints for valid data, keyed by field. */
export function rfqWarnings(data: Pick<RfqData, "email">): Record<string, string> {
  const warnings: Record<string, string> = {};
  if (isFreeMailAddress(data.email)) {
    warnings.email =
      "This looks like a personal email address. A company address helps us reply with a quotation sooner.";
  }
  return warnings;
}

const SCALAR_FIELDS = [
  "fullName",
  "companyName",
  "email",
  "phone",
  "country",
  "businessSegment",
  "intendedApplication",
  "additionalRequirements",
  "submissionId",
  HONEYPOT_FIELD,
] as const;
const ITEM_FIELDS = ["productId", "name", "quantity", "unit", "notes"] as const;
type ItemField = (typeof ITEM_FIELDS)[number];
const ITEM_KEY = /^items\.(\d{1,9})\.(productId|name|quantity|unit|notes)$/;

/**
 * Raw form values for rfqSchema. Lines arrive as `items.<i>.<field>`; a gap
 * in the indices becomes an invalid line (so error paths match the client's
 * indices) and an index past the limit becomes a "too many lines" error.
 */
export function rfqFromFormData(fd: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const out: Record<string, unknown> = {};
  for (const field of SCALAR_FIELDS) out[field] = text(field);
  const consent = text("consent");
  out.consent = consent === "on" || consent === "true";

  const lines = new Map<number, Partial<Record<ItemField, string>>>();
  let maxIndex = -1;
  for (const [key, value] of fd.entries()) {
    const m = ITEM_KEY.exec(key);
    if (!m || typeof value !== "string") continue;
    const index = Number(m[1]);
    maxIndex = Math.max(maxIndex, index);
    if (index > MAX_ITEMS) continue;
    const line = lines.get(index) ?? {};
    line[m[2] as ItemField] ??= value;
    lines.set(index, line);
  }
  const length = Math.min(maxIndex + 1, MAX_ITEMS + 1);
  out.items = Array.from({ length }, (_, i) => lines.get(i));
  return out;
}

/** Builds the FormData that submitRfq expects (used by the RFQ form). */
export function rfqToFormData(values: RfqInput, files: readonly File[] = []): FormData {
  const fd = new FormData();
  for (const field of SCALAR_FIELDS) {
    const v = values[field];
    if (typeof v === "string") fd.set(field, v);
  }
  if (values.consent === true) fd.set("consent", "on");
  values.items.forEach((item, i) => {
    for (const field of ITEM_FIELDS) {
      const v = item[field];
      if (v !== undefined && v !== null) fd.set(`items.${i}.${field}`, String(v));
    }
  });
  for (const file of files) fd.append(ATTACHMENTS_FIELD, file);
  return fd;
}
