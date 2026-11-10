import { describe, expect, it } from "vitest";
import { MAX_RECIPIENTS, parseRecipientsInput } from "@/features/enquiries/recipients";

describe("parseRecipientsInput", () => {
  it("splits on commas, semicolons and new lines, lower-cases and de-duplicates", () => {
    expect(parseRecipientsInput("a@x.com, A@X.com\nb@x.com; c@x.com\r\n")).toEqual({
      ok: true,
      emails: ["a@x.com", "b@x.com", "c@x.com"],
    });
  });

  it("accepts an empty or blank list (no recipients)", () => {
    expect(parseRecipientsInput("")).toEqual({ ok: true, emails: [] });
    expect(parseRecipientsInput("  \n , ; ")).toEqual({ ok: true, emails: [] });
  });

  it("rejects invalid entries and reports how many, without echoing them", () => {
    const result = parseRecipientsInput("good@x.com, nope, also-bad@");
    expect(result).toEqual({ ok: false, error: "2 entries are not valid email addresses." });
    expect(JSON.stringify(result)).not.toContain("nope");
    expect(parseRecipientsInput("nope")).toEqual({ ok: false, error: "1 entry is not a valid email address." });
  });

  it(`allows ${MAX_RECIPIENTS} addresses and rejects more`, () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => `u${i}@x.com`).join(",");
    expect(parseRecipientsInput(make(MAX_RECIPIENTS))).toMatchObject({ ok: true });
    expect(parseRecipientsInput(make(MAX_RECIPIENTS + 1))).toEqual({
      ok: false,
      error: `Add no more than ${MAX_RECIPIENTS} addresses.`,
    });
  });

  it("rejects an oversized blob before parsing it", () => {
    expect(parseRecipientsInput("a@x.com,".repeat(5000))).toMatchObject({ ok: false });
  });
});
