import { describe, expect, it } from "vitest";
import { generateReference, isReference, REFERENCE_PATTERN } from "@/features/enquiries/reference";

describe("generateReference", () => {
  it("formats AQ-<year>-<6 digits>, zero padded", () => {
    expect(generateReference(2026, 1)).toBe("AQ-2026-000001");
    expect(generateReference(2026, 123)).toBe("AQ-2026-000123");
    expect(generateReference(2031, 999_999)).toBe("AQ-2031-999999");
  });

  it("matches the published pattern", () => {
    expect(REFERENCE_PATTERN.test(generateReference(2026, 42))).toBe(true);
    expect(isReference("AQ-2026-000042")).toBe(true);
    expect(isReference("AQ-2026-42")).toBe(false);
    expect(isReference("aq-2026-000042")).toBe(false);
  });

  it("rejects sequence numbers that do not fit six digits", () => {
    for (const seq of [0, -1, 1_000_000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => generateReference(2026, seq)).toThrow(RangeError);
    }
  });

  it("rejects years that are not four digits", () => {
    for (const year of [999, 10_000, 2026.5, Number.NaN]) {
      expect(() => generateReference(year, 1)).toThrow(RangeError);
    }
  });
});
