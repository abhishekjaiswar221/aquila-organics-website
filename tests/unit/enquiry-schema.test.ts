import { describe, expect, it } from "vitest";
import {
  isHoneypotFilled,
  MAX_ITEMS,
  rfqFromFormData,
  rfqSchema,
  rfqToFormData,
  rfqWarnings,
  TEXT_LIMITS,
  type RfqInput,
} from "@/features/enquiries/schema";

const PRODUCT_ID = "3f2b8c1e-7d4a-4b6e-9c2f-1a2b3c4d5e6f";

function valid(overrides: Partial<Record<keyof RfqInput, unknown>> = {}): Record<string, unknown> {
  return {
    fullName: "TEST Jane Buyer",
    companyName: "TEST Fragrance House Ltd",
    email: "jane@testfragrance.example",
    phone: "+44 20 7946 0000",
    country: "United Kingdom",
    businessSegment: "FRAGRANCES",
    intendedApplication: "Fine fragrance",
    additionalRequirements: "",
    consent: true,
    website: "",
    items: [{ productId: PRODUCT_ID, name: "TEST Linalool", quantity: 25, unit: "KG" }],
    ...overrides,
  };
}

function issuesFor(input: unknown): Record<string, string[]> {
  const result = rfqSchema.safeParse(input);
  if (result.success) return {};
  const out: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

const item = (quantity: unknown) => ({ name: "TEST Free text", quantity, unit: "KG" });

describe("rfqSchema", () => {
  it("accepts a complete submission", () => {
    const result = rfqSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  it.each([0, -1, -0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects quantity %s",
    (quantity) => {
      expect(Object.keys(issuesFor(valid({ items: [item(quantity)] })))).toContain("items.0.quantity");
    },
  );

  it("rejects quantities with more than three decimals, above the cap, or non-numeric text", () => {
    for (const q of [1.2345, 1e12, "abc", "1,5", "", "  "]) {
      expect(Object.keys(issuesFor(valid({ items: [item(q)] }))), String(q)).toContain("items.0.quantity");
    }
  });

  it("accepts numeric strings (form fields) and three decimals", () => {
    const result = rfqSchema.safeParse(valid({ items: [item(" 12.125 ")] }));
    expect(result.success && result.data.items[0].quantity).toBe(12.125);
  });

  it("rejects zero lines and more than 25 lines", () => {
    expect(issuesFor(valid({ items: [] }))).toHaveProperty("items");
    const many = Array.from({ length: MAX_ITEMS + 1 }, () => item(1));
    expect(issuesFor(valid({ items: many }))).toHaveProperty("items");
    const max = Array.from({ length: MAX_ITEMS }, () => item(1));
    expect(rfqSchema.safeParse(valid({ items: max })).success).toBe(true);
  });

  it("requires consent to be exactly true", () => {
    for (const consent of [undefined, false, "true", "on"]) {
      expect(issuesFor(valid({ consent }))).toHaveProperty("consent");
    }
  });

  it("rejects a bad email", () => {
    for (const email of ["", "not-an-email", "a@b", "jane@@x.example"]) {
      expect(issuesFor(valid({ email })), email).toHaveProperty("email");
    }
  });

  it("free-mail address is a warning, never an error", () => {
    for (const email of ["jane@gmail.com", "JANE@Yahoo.co.uk", "j@outlook.com", "j@hotmail.com"]) {
      const result = rfqSchema.safeParse(valid({ email }));
      expect(result.success, email).toBe(true);
      if (result.success) expect(rfqWarnings(result.data)).toHaveProperty("email");
    }
    const business = rfqSchema.safeParse(valid());
    expect(business.success && rfqWarnings(business.data)).toEqual({});
  });

  it("rejects missing required contact fields and an unknown segment", () => {
    const errors = issuesFor(
      valid({ fullName: "   ", companyName: "", phone: "", country: "", businessSegment: "SPACE" }),
    );
    for (const key of ["fullName", "companyName", "phone", "country", "businessSegment"]) {
      expect(errors, key).toHaveProperty(key);
    }
  });

  it("rejects over-long text (after trimming) instead of storing it", () => {
    const long = (n: number) => "x".repeat(n);
    const errors = issuesFor(
      valid({
        fullName: long(TEXT_LIMITS.fullName + 1),
        additionalRequirements: long(TEXT_LIMITS.additionalRequirements + 1),
        items: [{ name: long(TEXT_LIMITS.itemName + 1), quantity: 1, unit: "KG", notes: long(TEXT_LIMITS.itemNotes + 1) }],
      }),
    );
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(["fullName", "additionalRequirements", "items.0.name", "items.0.notes"]),
    );
    // Surrounding whitespace does not count towards the limit.
    const padded = rfqSchema.safeParse(valid({ fullName: `  ${long(TEXT_LIMITS.fullName)}  ` }));
    expect(padded.success).toBe(true);
  });

  it("trims strings and strips control and invisible characters", () => {
    const result = rfqSchema.safeParse(
      valid({
        fullName: "  TEST\u{0000} Jane\u{200B}\u{202E} Buyer\u{0007} ",
        companyName: "TEST\nCo\r\nLtd",
        additionalRequirements: "line one\u{0000}\nline two\u{001B}[31m",
        items: [{ name: "\u{FEFF}TEST Linalool\u{0085}", quantity: 1, unit: "KG", notes: " \u{0008}note " }],
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fullName).toBe("TEST Jane Buyer");
    expect(result.data.companyName).toBe("TEST Co Ltd");
    // Multi-line fields keep line breaks but lose other controls.
    expect(result.data.additionalRequirements).toBe("line one\nline two[31m");
    expect(result.data.items[0].name).toBe("TEST Linalool");
    expect(result.data.items[0].notes).toBe("note");
  });

  it("turns empty optional text into undefined", () => {
    const result = rfqSchema.safeParse(valid({ intendedApplication: "   ", additionalRequirements: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.intendedApplication).toBeUndefined();
      expect(result.data.additionalRequirements).toBeUndefined();
    }
  });

  it("validates line product ids as uuids and units as the enum", () => {
    const errors = issuesFor(
      valid({ items: [{ productId: "1 OR 1=1", name: "TEST x", quantity: 1, unit: "BARREL" }] }),
    );
    expect(errors).toHaveProperty(["items.0.productId"]);
    expect(errors).toHaveProperty(["items.0.unit"]);
    const empty = rfqSchema.safeParse(valid({ items: [{ productId: "", name: "TEST x", quantity: 1, unit: "G" }] }));
    expect(empty.success && empty.data.items[0].productId).toBeUndefined();
  });

  it("accepts an optional uuid submissionId (idempotency token)", () => {
    const token = "9b2f6c1e-3d4a-4e5f-8a7b-6c5d4e3f2a1b";
    const withToken = rfqSchema.safeParse(valid({ submissionId: ` ${token.toUpperCase()} ` }));
    expect(withToken.success && withToken.data.submissionId).toBe(token);
    const without = rfqSchema.safeParse(valid({ submissionId: "" }));
    expect(without.success && without.data.submissionId).toBeUndefined();
    expect(issuesFor(valid({ submissionId: "replay-me" }))).toHaveProperty("submissionId");
  });

  it("accepts the honeypot field but flags it when filled", () => {
    const clean = rfqSchema.safeParse(valid());
    expect(clean.success && isHoneypotFilled(clean.data)).toBe(false);
    const absent = rfqSchema.safeParse(valid({ website: undefined }));
    expect(absent.success && isHoneypotFilled(absent.data)).toBe(false);
    const bot = rfqSchema.safeParse(valid({ website: "http://spam.example" }));
    expect(bot.success).toBe(true);
    expect(bot.success && isHoneypotFilled(bot.data)).toBe(true);
  });
});

describe("form data round trip", () => {
  it("rfqToFormData and rfqFromFormData agree", () => {
    const values = valid({
      submissionId: "9b2f6c1e-3d4a-4e5f-8a7b-6c5d4e3f2a1b",
      items: [
        { productId: PRODUCT_ID, name: "TEST Linalool", quantity: 25, unit: "KG" },
        { name: "TEST Custom blend", quantity: 0.5, unit: "L", notes: "sample first" },
      ],
    }) as unknown as RfqInput;
    const fd = rfqToFormData(values);
    const parsed = rfqSchema.safeParse(rfqFromFormData(fd));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.consent).toBe(true);
    expect(parsed.data.submissionId).toBe("9b2f6c1e-3d4a-4e5f-8a7b-6c5d4e3f2a1b");
    expect(parsed.data.items).toEqual([
      { productId: PRODUCT_ID, name: "TEST Linalool", quantity: 25, unit: "KG" },
      { name: "TEST Custom blend", quantity: 0.5, unit: "L", notes: "sample first" },
    ]);
  });

  it("an index gap leaves an invalid line rather than silently shifting lines", () => {
    const fd = new FormData();
    fd.set("items.0.name", "TEST a");
    fd.set("items.0.quantity", "1");
    fd.set("items.0.unit", "KG");
    fd.set("items.2.name", "TEST c");
    fd.set("items.2.quantity", "1");
    fd.set("items.2.unit", "KG");
    const input = rfqFromFormData(fd) as { items: unknown[] };
    expect(input.items).toHaveLength(3);
    expect(Object.keys(issuesFor({ ...valid(), items: input.items }))).toContain("items.1");
  });

  it("an absurd line index is reported as too many lines, not allocated", () => {
    const fd = new FormData();
    fd.set("items.999999.name", "TEST z");
    const input = rfqFromFormData(fd) as { items: unknown[] };
    expect(input.items.length).toBeLessThanOrEqual(MAX_ITEMS + 1);
    expect(issuesFor({ ...valid(), items: input.items })).toHaveProperty("items");
  });

  it("consent only counts when the checkbox value is sent", () => {
    const fd = new FormData();
    expect((rfqFromFormData(fd) as { consent: unknown }).consent).toBe(false);
    fd.set("consent", "on");
    expect((rfqFromFormData(fd) as { consent: unknown }).consent).toBe(true);
  });
});
