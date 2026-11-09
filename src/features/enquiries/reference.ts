/** Enquiry references: `AQ-<year>-<6-digit sequence>`, e.g. AQ-2026-000123. */
export const REFERENCE_PATTERN = /^AQ-\d{4}-\d{6}$/;

export const MAX_REFERENCE_SEQ = 999_999;

export function generateReference(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError("Reference year must be a four-digit integer");
  }
  if (!Number.isInteger(seq) || seq < 1 || seq > MAX_REFERENCE_SEQ) {
    throw new RangeError("Reference sequence must be an integer from 1 to 999999");
  }
  return `AQ-${year}-${String(seq).padStart(6, "0")}`;
}

export function isReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
