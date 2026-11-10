import type { CertificateRecord } from "@/content/types";

export type CertificateStatus = "active" | "expired" | "unconfirmed";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Strict ISO `YYYY-MM-DD` to UTC midnight in ms; null for anything malformed or impossible (e.g. 2026-02-30). */
function parseDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const time = Date.UTC(y, mo - 1, d);
  const check = new Date(time);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return time;
}

/**
 * Whether an entry may be shown as a current certificate.
 * - Anything not `verified` is unconfirmed, whatever its dates say.
 * - A malformed date (`""` included) makes the entry unconfirmed; only `null` means "no date".
 * - With an expiry date: active through the whole expiry day (UTC), expired from the first
 *   millisecond after it.
 * - With no expiry date: active only if an issue date exists, otherwise unconfirmed.
 */
export function certificateStatus(cert: CertificateRecord, now: Date): CertificateStatus {
  if (cert.status !== "verified") return "unconfirmed";
  if (cert.issuedOn !== null && parseDay(cert.issuedOn) === null) return "unconfirmed";
  if (cert.expiresOn === null) return cert.issuedOn !== null ? "active" : "unconfirmed";
  const expiry = parseDay(cert.expiresOn);
  if (expiry === null) return "unconfirmed";
  return now.getTime() >= expiry + DAY_MS ? "expired" : "active";
}

/**
 * True when at least one entry is verified. Needs no clock, so it is safe to use for static
 * decisions (the page's robots meta and the sitemap) that must not depend on the current time.
 */
export function hasConfirmedCertificates(certs: readonly CertificateRecord[]): boolean {
  return certs.some((c) => c.status === "verified");
}

export function activeCertificates(certs: readonly CertificateRecord[], now: Date): CertificateRecord[] {
  return certs.filter((c) => certificateStatus(c, now) === "active");
}

export function expiredCertificates(certs: readonly CertificateRecord[], now: Date): CertificateRecord[] {
  return certs.filter((c) => certificateStatus(c, now) === "expired");
}
