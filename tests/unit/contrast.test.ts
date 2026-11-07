import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

const IVORY = "#F6F2E9";

describe("contrastRatio", () => {
  it("charcoal on ivory is AAA body text", () => {
    expect(contrastRatio("#24231F", IVORY)).toBeGreaterThanOrEqual(7);
  });
  it("darkened bronze on ivory passes AA for small text", () => {
    expect(contrastRatio("#7A5F33", IVORY)).toBeGreaterThanOrEqual(4.5);
  });
  it("raw bronze on ivory fails AA, so it is large-text/decoration only", () => {
    expect(contrastRatio("#A88958", IVORY)).toBeLessThan(4.5);
  });
  it("white on charcoal passes AAA", () => {
    expect(contrastRatio("#FFFFFF", "#24231F")).toBeGreaterThanOrEqual(7);
  });
  it("ivory on charcoal passes AAA (dark sections)", () => {
    expect(contrastRatio(IVORY, "#24231F")).toBeGreaterThanOrEqual(7);
  });
  it("records olive on ivory (informational ceiling for usage)", () => {
    const r = contrastRatio("#777B5B", IVORY);
    console.info(`olive on ivory = ${r.toFixed(2)}`);
    expect(r).toBeGreaterThan(2);
  });
});
