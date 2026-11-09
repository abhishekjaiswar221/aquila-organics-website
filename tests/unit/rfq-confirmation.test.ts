import { describe, expect, it } from "vitest";
import { confirmationHref, parseConfirmationRef } from "@/features/enquiries/confirmation";

describe("parseConfirmationRef", () => {
  it("accepts a well-formed reference", () => {
    expect(parseConfirmationRef("AQ-2026-000123")).toBe("AQ-2026-000123");
  });

  it.each([
    undefined,
    "",
    "aq-2026-000123",
    "AQ-2026-12345",
    "AQ-2026-0001234",
    "AQ-26-000123",
    " AQ-2026-000123",
    "AQ-2026-000123\n",
    "<script>alert(1)</script>",
    "AQ-2026-000123&email=x@y.z",
  ])("rejects %j", (value) => {
    expect(parseConfirmationRef(value)).toBeNull();
  });

  it("rejects repeated parameters", () => {
    expect(parseConfirmationRef(["AQ-2026-000123", "AQ-2026-000124"])).toBeNull();
  });
});

describe("confirmationHref", () => {
  it("carries the reference only", () => {
    expect(confirmationHref("AQ-2026-000123")).toBe("/rfq/confirmation?ref=AQ-2026-000123");
  });
});
