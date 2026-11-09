const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * One canonical form per inbox, for rate-limit keys only (mail is always sent
 * to the address exactly as typed). Trims and lowercases; strips a "+tag"
 * from the local part for every domain; for Gmail also drops dots and maps
 * googlemail.com to gmail.com. If stripping would leave an empty local part,
 * the trimmed, lowercased address is returned unchanged.
 */
export function normaliseRecipientForLimit(address: string): string {
  const lower = address.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at === -1) return lower;
  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  return local ? `${local}@${domain}` : lower;
}
