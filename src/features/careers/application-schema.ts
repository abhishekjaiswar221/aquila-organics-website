import { z } from "zod";
import { cleanLine, cleanMultiline, HONEYPOT_FIELD, rfqSchema } from "@/features/enquiries/schema";

/**
 * The careers application form, shared by the client form and the
 * submitApplication server action, which validates again. Isomorphic: imports
 * nothing server-only. The CV is a file part (CV_FIELD), validated separately.
 *
 * Same text rules as the RFQ and contact forms: trimmed, control and invisible
 * characters removed, over-long text rejected rather than truncated.
 */

export const CV_FIELD = "cv";
export const JOB_FIELD = "job";
export const APPLICATION_MESSAGE_MAX = 2000;
/** Ceiling on the RAW message, checked before the cleaning passes run (see contact/schema.ts). */
const MESSAGE_RAW_MAX = APPLICATION_MESSAGE_MAX * 4;
const JOB_SLUG_MAX = 200;
const PHONE_MAX = 40;
const COUNTRY_MAX = 80;
const PHONE_CHARS = /^[0-9+()\-./\s#xX]+$/;

function optionalLine(label: string, max: number) {
  return z
    .string()
    .optional()
    .transform((v) => (v === undefined ? "" : cleanLine(v)))
    .pipe(z.string().max(max, { error: `${label} must be at most ${max} characters` }))
    .transform((v) => (v === "" ? undefined : v));
}

export const applicationSchema = rfqSchema
  .pick({ fullName: true, consent: true, submissionId: true, website: true })
  .extend({
    /** Cleaned and lower-cased, so the same address is stored one way. */
    email: z
      .string({ error: "Email is required" })
      .transform(cleanLine)
      .pipe(z.email({ error: "Enter a valid email address" }).max(254, { error: "Enter a valid email address" }))
      .transform((v) => v.toLowerCase()),
    phone: optionalLine("Telephone", PHONE_MAX).refine((v) => v === undefined || PHONE_CHARS.test(v), {
      error: "Enter a valid telephone number",
    }),
    country: optionalLine("Country", COUNTRY_MAX),
    message: z
      .string()
      .max(MESSAGE_RAW_MAX, { error: `Message must be at most ${APPLICATION_MESSAGE_MAX} characters` })
      .optional()
      .transform((v) => (v === undefined ? "" : cleanMultiline(v)))
      .pipe(
        z.string().max(APPLICATION_MESSAGE_MAX, {
          error: `Message must be at most ${APPLICATION_MESSAGE_MAX} characters`,
        }),
      )
      .transform((v) => (v === "" ? undefined : v)),
    /** Slug of the opening applied for; "" or absent means a general application. */
    job: z
      .string()
      .max(JOB_SLUG_MAX)
      .optional()
      .transform((v) => (v === undefined ? undefined : v.trim() || undefined)),
  });

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationData = z.output<typeof applicationSchema>;

export const APPLICATION_FIELDS = [
  "fullName",
  "email",
  "phone",
  "country",
  "message",
  JOB_FIELD,
  "submissionId",
  HONEYPOT_FIELD,
] as const;

/** Raw form values for applicationSchema. Non-string parts and unknown keys are ignored. */
export function applicationFromFormData(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of APPLICATION_FIELDS) {
    const v = fd.get(field);
    out[field] = typeof v === "string" ? v : undefined;
  }
  const consent = fd.get("consent");
  out.consent = consent === "on" || consent === "true";
  return out;
}
