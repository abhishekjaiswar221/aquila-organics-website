import "server-only";
import type { EnquiryType } from "@/generated/prisma/enums";
import { parseRecipients, recipientsKey } from "@/features/enquiries/recipients";
import { db } from "@/lib/db";

/** Enquiry types whose internal notification goes to an editable list. */
export const RECIPIENT_TYPES = ["FRAGRANCES", "AROMA_CHEMICALS", "FLAVOURS", "GENERAL", "CAREERS"] as const satisfies readonly EnquiryType[];
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export function isRecipientType(value: unknown): value is RecipientType {
  return typeof value === "string" && (RECIPIENT_TYPES as readonly string[]).includes(value);
}

/** The stored recipients for every editable type (empty list when none is stored). */
export async function getAllRecipients(): Promise<Record<RecipientType, string[]>> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: RECIPIENT_TYPES.map(recipientsKey) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    RECIPIENT_TYPES.map((t) => [t, parseRecipients(byKey.get(recipientsKey(t)))]),
  ) as Record<RecipientType, string[]>;
}
