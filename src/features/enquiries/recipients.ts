import { z } from "zod";
import type { EnquiryType } from "@/generated/prisma/enums";

export const MAX_RECIPIENTS = 20;

/** SiteSetting key holding the internal notification recipients for a type. */
export function recipientsKey(type: EnquiryType): string {
  return `notification.recipients.${type}`;
}

/**
 * Valid, de-duplicated, lower-cased addresses from a stored SiteSetting value
 * (a JSON array of strings). Anything else yields no recipients.
 */
export function parseRecipients(value: unknown): string[] {
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
