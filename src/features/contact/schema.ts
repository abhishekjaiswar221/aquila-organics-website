import { z } from "zod";
import { findApplication, type SegmentId } from "@/content/segments";
import type { ApplicationRecord } from "@/content/types";
import {
  ATTACHMENTS_FIELD,
  cleanMultiline,
  HONEYPOT_FIELD,
  rfqSchema,
  type BusinessSegment,
} from "@/features/enquiries/schema";

/**
 * The Contact page forms (one per business segment), shared by the client
 * form and the submitContact server action, which validates again.
 * Isomorphic: imports nothing server-only.
 *
 * The contact fields reuse the RFQ rules (rfqSchema's own field schemas), so
 * the two forms cannot drift. The enquiry type is chosen from CONTACT_TYPES
 * only: anything else, including CAREERS, is a field error and never falls
 * back to another type.
 */

export const CONTACT_TYPES = ["FRAGRANCES", "FLAVOURS", "AROMA_CHEMICALS", "GENERAL"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 4000;
/**
 * Ceiling on the RAW message, checked before the cleaning passes run. Cleaning strips control and
 * invisible characters with several linear regex passes, so without this a request carrying the full
 * server-action body (up to 52 MB) would be scanned in full before any length rule applied.
 */
export const CONTACT_MESSAGE_RAW_MAX = CONTACT_MESSAGE_MAX * 4;

/** The types whose form offers an application, and the segment holding their slugs. */
const APPLICATION_SEGMENT: Partial<Record<ContactType, SegmentId>> = {
  FRAGRANCES: "fragrances",
  FLAVOURS: "flavours",
};

const BUSINESS_SEGMENT: Record<ContactType, BusinessSegment> = {
  FRAGRANCES: "FRAGRANCES",
  FLAVOURS: "FLAVOURS",
  AROMA_CHEMICALS: "AROMA_CHEMICALS",
  GENERAL: "OTHER",
};

export function isContactType(value: unknown): value is ContactType {
  return typeof value === "string" && (CONTACT_TYPES as readonly string[]).includes(value);
}

/** True when the type's form has an application choice (fragrances and flavours). */
export function contactHasApplications(type: ContactType): boolean {
  return APPLICATION_SEGMENT[type] !== undefined;
}

/** The fixed application record for this type and slug (exact match), if any. */
export function contactApplication(type: ContactType, slug: string): ApplicationRecord | undefined {
  const segment = APPLICATION_SEGMENT[type];
  return segment ? findApplication(segment, slug) : undefined;
}

/** The value stored in Enquiry.businessSegment for a contact type. */
export function contactBusinessSegment(type: ContactType): BusinessSegment {
  return BUSINESS_SEGMENT[type];
}

const contactFields = rfqSchema.pick({
  fullName: true,
  companyName: true,
  email: true,
  phone: true,
  country: true,
  consent: true,
  submissionId: true,
  website: true,
});

const messageError = `Please write a message of at least ${CONTACT_MESSAGE_MIN} characters`;

export const contactSchema = contactFields
  .extend({
    type: z.enum(CONTACT_TYPES, { error: "Choose what your enquiry is about" }),
    /** A slug from the fixed list of the type's segment; "" means none. */
    application: z
      .string({ error: "Choose an application from the list" })
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    message: z
      .string({ error: messageError })
      .max(CONTACT_MESSAGE_RAW_MAX, { error: `Message must be at most ${CONTACT_MESSAGE_MAX} characters` })
      .transform(cleanMultiline)
      .pipe(
        z
          .string()
          .min(CONTACT_MESSAGE_MIN, { error: messageError })
          .max(CONTACT_MESSAGE_MAX, { error: `Message must be at most ${CONTACT_MESSAGE_MAX} characters` }),
      ),
  })
  .superRefine(
    (data, ctx) => {
      if (data.application === undefined) return;
      if (!contactHasApplications(data.type)) {
        ctx.addIssue({
          code: "custom",
          path: ["application"],
          message: "An application can only be chosen for fragrance or flavour enquiries",
        });
      } else if (!contactApplication(data.type, data.application)) {
        ctx.addIssue({ code: "custom", path: ["application"], message: "Choose an application from the list" });
      }
    },
    {
      // Also report a bad application next to other field errors, but only
      // once the type itself is valid.
      when: (payload) => !payload.issues.some((i) => i.path?.[0] === "type" || i.path?.[0] === "application"),
    },
  );

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

const CONTACT_FIELDS = [
  "type",
  "fullName",
  "companyName",
  "email",
  "phone",
  "country",
  "application",
  "message",
  "submissionId",
  HONEYPOT_FIELD,
] as const;

/** Raw form values for contactSchema. Non-string parts are ignored. */
export function contactFromFormData(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of CONTACT_FIELDS) {
    const v = fd.get(field);
    out[field] = typeof v === "string" ? v : undefined;
  }
  const consent = fd.get("consent");
  out.consent = consent === "on" || consent === "true";
  return out;
}

/** Builds the FormData that submitContact expects (used by the Contact forms). */
export function contactToFormData(values: Partial<ContactInput>, files: readonly File[] = []): FormData {
  const fd = new FormData();
  for (const field of CONTACT_FIELDS) {
    const v = values[field];
    if (typeof v === "string") fd.set(field, v);
  }
  if (values.consent === true) fd.set("consent", "on");
  for (const file of files) fd.append(ATTACHMENTS_FIELD, file);
  return fd;
}
