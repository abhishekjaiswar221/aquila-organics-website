import type { Block, CertificateRecord } from "./types";

export const certificationsMeta = {
  title: "Certifications",
  lead: "Certificates held by Aquila Organics.",
  description: "Certificates held by Aquila Organics, with issuing body, dates and scope.",
} as const;

/**
 * Starts EMPTY on purpose. An entry is added only when the client has confirmed the
 * issuer, issue and expiry dates and what it covers; its status must be "verified".
 * Entries past their expiry date are never presented as current (see src/lib/certificates.ts).
 */
export const certificates: CertificateRecord[] = [];

export const certificationsPending: Block<string> = {
  id: "certifications-pending",
  status: "verified",
  data: "Our certificates are being compiled. Each entry will list the certificate, the issuing body, its dates and the facility or business it covers once these have been confirmed.",
};
