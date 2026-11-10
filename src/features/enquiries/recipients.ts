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

const MAX_RECIPIENTS_INPUT_LENGTH = 4000;

/**
 * Admin text input (addresses separated by commas, semicolons or new lines).
 * Unlike parseRecipients, which silently skips bad stored values, this
 * rejects anything that is not a valid address, so a typo is never dropped
 * without the editor noticing. Entries are never echoed in the error.
 */
export function parseRecipientsInput(raw: string): { ok: true; emails: string[] } | { ok: false; error: string } {
  if (raw.length > MAX_RECIPIENTS_INPUT_LENGTH) return { ok: false, error: "That list is too long." };
  const email = z.email();
  const entries = raw
    .split(/[,;\r\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const bad = entries.filter((e) => !email.safeParse(e).success).length;
  if (bad > 0) {
    return { ok: false, error: bad === 1 ? "1 entry is not a valid email address." : `${bad} entries are not valid email addresses.` };
  }
  const emails = [...new Set(entries)];
  if (emails.length > MAX_RECIPIENTS) return { ok: false, error: `Add no more than ${MAX_RECIPIENTS} addresses.` };
  return { ok: true, emails };
}
