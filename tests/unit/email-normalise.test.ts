import { describe, expect, it } from "vitest";
import { normaliseRecipientForLimit } from "@/lib/email-normalise";

describe("normaliseRecipientForLimit", () => {
  it("trims and lowercases", () => {
    expect(normaliseRecipientForLimit("  Jane@Example.COM  ")).toBe("jane@example.com");
  });

  it("strips a +tag for every domain", () => {
    expect(normaliseRecipientForLimit("jane+rfq@example.com")).toBe("jane@example.com");
    expect(normaliseRecipientForLimit("jane+a+b+c@example.com")).toBe("jane@example.com");
    expect(normaliseRecipientForLimit("JANE+X@Example.com")).toBe("jane@example.com");
  });

  it("keeps dots outside Gmail", () => {
    expect(normaliseRecipientForLimit("jane.doe@example.com")).toBe("jane.doe@example.com");
    expect(normaliseRecipientForLimit("jane.doe+x@outlook.com")).toBe("jane.doe@outlook.com");
  });

  it("removes dots for Gmail and treats googlemail.com as gmail.com", () => {
    expect(normaliseRecipientForLimit("v.i.c.t.i.m@gmail.com")).toBe("victim@gmail.com");
    expect(normaliseRecipientForLimit("v.ictim+2@googlemail.com")).toBe("victim@gmail.com");
    expect(normaliseRecipientForLimit("VICTIM@GMAIL.COM")).toBe("victim@gmail.com");
    expect(normaliseRecipientForLimit("victim+1@gmail.com")).toBe("victim@gmail.com");
  });

  it("falls back to the lowercased address when stripping leaves an empty local part", () => {
    expect(normaliseRecipientForLimit("+tag@example.com")).toBe("+tag@example.com");
    expect(normaliseRecipientForLimit(" +Tag@Example.com")).toBe("+tag@example.com");
    expect(normaliseRecipientForLimit("...@gmail.com")).toBe("...@gmail.com");
    expect(normaliseRecipientForLimit(".+x@gmail.com")).toBe(".+x@gmail.com");
  });

  it("uses the last @ as the domain separator and leaves addresses without one lowercased", () => {
    expect(normaliseRecipientForLimit('"a@b"+x@example.com')).toBe('"a@b"@example.com');
    expect(normaliseRecipientForLimit("Not-An-Address")).toBe("not-an-address");
  });
});
