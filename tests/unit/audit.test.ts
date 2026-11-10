import { describe, expect, it } from "vitest";
import { sanitiseAuditChangedFields, sanitiseAuditDetail } from "@/features/admin/audit-detail";

describe("sanitiseAuditDetail", () => {
  it("keeps ids, enums, numbers and booleans", () => {
    expect(sanitiseAuditDetail({ from: "DRAFT", to: "PUBLISHED", count: 3, verified: true })).toEqual({
      from: "DRAFT",
      to: "PUBLISHED",
      count: 3,
      verified: true,
    });
  });

  it("drops keys that could carry personal data or free text", () => {
    const out = sanitiseAuditDetail({
      email: "a@b.co",
      userEmail: "a@b.co",
      password: "x",
      fullName: "x",
      sourceNote: "x",
      notes: "x",
      bodyText: "x",
      message: "x",
      kind: "SDS",
    });
    expect(out).toEqual({ kind: "SDS" });
  });

  it("drops non-primitive values and strings longer than 80 characters", () => {
    const out = sanitiseAuditDetail({
      a: { nested: 1 },
      b: [1, 2],
      c: null,
      d: undefined,
      e: "x".repeat(81),
      f: "x".repeat(80),
    } as never);
    expect(out).toEqual({ f: "x".repeat(80) });
  });

  it("returns undefined when nothing survives", () => {
    expect(sanitiseAuditDetail(undefined)).toBeUndefined();
    expect(sanitiseAuditDetail({ email: "a@b.co" })).toBeUndefined();
  });
});

describe("sanitiseAuditChangedFields", () => {
  it("de-duplicates and caps at 30", () => {
    expect(sanitiseAuditChangedFields(["a", "b", "a"])).toEqual(["a", "b"]);
    const many = Array.from({ length: 50 }, (_, i) => `f${i}`);
    expect(sanitiseAuditChangedFields(many)).toHaveLength(30);
    expect(sanitiseAuditChangedFields(undefined)).toEqual([]);
  });
});
