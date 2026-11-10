import { describe, expect, it } from "vitest";
import {
  CONTACT_MESSAGE_MAX,
  CONTACT_MESSAGE_MIN,
  CONTACT_MESSAGE_RAW_MAX,
  CONTACT_TYPES,
  contactBusinessSegment,
  contactFromFormData,
  contactSchema,
  contactToFormData,
  type ContactInput,
} from "@/features/contact/schema";
import { contactApplication } from "@/features/contact/applications";
import { buildContactFormData, pristineContactValues, type ContactFormValues } from "@/features/contact/form-state";
import { TEXT_LIMITS } from "@/features/enquiries/schema";

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "FRAGRANCES",
    fullName: "TEST Jane Buyer",
    companyName: "TEST Fragrance House Ltd",
    email: "jane@testfragrance.example",
    phone: "+44 20 7946 0000",
    country: "United Kingdom",
    application: "fine-fragrance",
    message: "TEST We would like to discuss a fine fragrance brief.",
    consent: true,
    website: "",
    ...overrides,
  };
}

function issuesFor(input: unknown): Record<string, string[]> {
  const result = contactSchema.safeParse(input);
  if (result.success) return {};
  const out: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

describe("CONTACT_TYPES", () => {
  it("is exactly the four business segments, never CAREERS", () => {
    expect([...CONTACT_TYPES]).toEqual(["FRAGRANCES", "FLAVOURS", "AROMA_CHEMICALS", "GENERAL"]);
    expect(CONTACT_TYPES).not.toContain("CAREERS");
  });
});

describe("contactSchema", () => {
  it("accepts a complete submission for each type", () => {
    expect(contactSchema.safeParse(valid()).success).toBe(true);
    expect(contactSchema.safeParse(valid({ type: "FLAVOURS", application: "bakery" })).success).toBe(true);
    expect(contactSchema.safeParse(valid({ type: "AROMA_CHEMICALS", application: undefined })).success).toBe(true);
    expect(contactSchema.safeParse(valid({ type: "GENERAL", application: "" })).success).toBe(true);
    expect(contactSchema.safeParse(valid({ application: undefined })).success).toBe(true);
  });

  it("rejects CAREERS, ADMIN, empty, missing and lowercase types as a field error on type", () => {
    for (const type of ["CAREERS", "ADMIN", "", "fragrances", "Flavours", " GENERAL", undefined, 1, null]) {
      const issues = issuesFor(valid({ type }));
      expect(Object.keys(issues), String(type)).toContain("type");
    }
  });

  it("cleans and bounds the message: trimmed, control characters stripped, 10..4000 characters", () => {
    expect(CONTACT_MESSAGE_MIN).toBe(10);
    expect(CONTACT_MESSAGE_MAX).toBe(4000);
    const parsed = contactSchema.parse(valid({ message: "  TEST line one\u0000‮\r\nline two\t ok  " }));
    expect(parsed.message).toBe("TEST line one\nline two\t ok");

    expect(issuesFor(valid({ message: "short" }))).toHaveProperty("message");
    // Ten characters only after cleaning counts.
    expect(issuesFor(valid({ message: `   123456789${"​".repeat(5)}   ` }))).toHaveProperty("message");
    expect(issuesFor(valid({ message: "" }))).toHaveProperty("message");
    expect(issuesFor(valid({ message: undefined }))).toHaveProperty("message");
    expect(issuesFor(valid({ message: "x".repeat(10) }))).toEqual({});
    expect(issuesFor(valid({ message: "x".repeat(4000) }))).toEqual({});
    expect(issuesFor(valid({ message: "x".repeat(4001) }))).toHaveProperty("message");
  });

  it("requires consent", () => {
    for (const consent of [false, undefined, "on", "true"]) {
      expect(issuesFor(valid({ consent })), String(consent)).toHaveProperty("consent");
    }
  });

  it("validates the application against the fixed slug list of the chosen segment", () => {
    // Wrong segment, unknown, case variants, traversal and padded values.
    for (const [type, application] of [
      ["FRAGRANCES", "bakery"],
      ["FLAVOURS", "fine-fragrance"],
      ["FRAGRANCES", "FINE-FRAGRANCE"],
      ["FRAGRANCES", "../fine-fragrance"],
      ["FRAGRANCES", " fine-fragrance"],
      ["FLAVOURS", "x".repeat(500)],
    ]) {
      expect(Object.keys(issuesFor(valid({ type, application }))), `${type} ${application}`).toEqual(["application"]);
    }
  });

  it("rejects any application for aroma chemicals and general enquiries", () => {
    expect(Object.keys(issuesFor(valid({ type: "AROMA_CHEMICALS", application: "fine-fragrance" })))).toEqual([
      "application",
    ]);
    expect(Object.keys(issuesFor(valid({ type: "GENERAL", application: "bakery" })))).toEqual(["application"]);
  });

  it("reuses the RFQ contact field rules", () => {
    const issues = issuesFor(
      valid({ email: "not-an-email", phone: "abc", fullName: "x".repeat(TEXT_LIMITS.fullName + 1), country: "" }),
    );
    expect(Object.keys(issues).sort()).toEqual(["country", "email", "fullName", "phone"]);
    expect(issuesFor(valid({ submissionId: "not-a-uuid" }))).toHaveProperty("submissionId");
    expect(contactSchema.parse(valid({ submissionId: " 5A4B3C2D-1E0F-4A9B-8C7D-6E5F4A3B2C1D " })).submissionId).toBe(
      "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d",
    );
  });

  it("does not accept product lines or other unknown keys into the output", () => {
    const parsed = contactSchema.parse(valid({ items: [{ name: "x" }], businessSegment: "OTHER", status: "WON" }));
    expect(parsed).not.toHaveProperty("items");
    expect(parsed).not.toHaveProperty("businessSegment");
    expect(parsed).not.toHaveProperty("status");
  });
});

describe("contactApplication and contactBusinessSegment", () => {
  it("resolves an application record only for its own segment", () => {
    expect(contactApplication("FRAGRANCES", "fine-fragrance")?.name).toBe("Fine Fragrance");
    expect(contactApplication("FLAVOURS", "bakery")?.slug).toBe("bakery");
    expect(contactApplication("FLAVOURS", "fine-fragrance")).toBeUndefined();
    expect(contactApplication("AROMA_CHEMICALS", "fine-fragrance")).toBeUndefined();
    expect(contactApplication("GENERAL", "bakery")).toBeUndefined();
  });

  it("maps each type to the stored business segment", () => {
    expect(contactBusinessSegment("FRAGRANCES")).toBe("FRAGRANCES");
    expect(contactBusinessSegment("FLAVOURS")).toBe("FLAVOURS");
    expect(contactBusinessSegment("AROMA_CHEMICALS")).toBe("AROMA_CHEMICALS");
    expect(contactBusinessSegment("GENERAL")).toBe("OTHER");
  });
});

describe("contact FormData round trip", () => {
  it("contactToFormData and contactFromFormData agree with the schema", () => {
    const values: ContactInput = {
      type: "FLAVOURS",
      fullName: "TEST Jane Buyer",
      companyName: "TEST Co",
      email: "jane@testfragrance.example",
      phone: "+44 20 7946 0000",
      country: "India",
      application: "bakery",
      message: "TEST multi\nline message",
      consent: true,
      submissionId: "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d",
    };
    const file = new File(["%PDF-1.4"], "TEST.pdf", { type: "application/pdf" });
    const fd = contactToFormData(values, [file]);
    expect(fd.get("consent")).toBe("on");
    expect(fd.getAll("attachments")).toHaveLength(1);
    const raw = contactFromFormData(fd);
    expect(contactSchema.parse(raw)).toMatchObject({ ...values, message: "TEST multi\nline message" });
  });

  it("buildContactFormData sends the token and consent only when ticked", () => {
    const values = { ...pristineContactValues("GENERAL"), message: "TEST hello there", consent: false };
    const unticked = buildContactFormData(values as ContactFormValues, "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d", []);
    expect(unticked.get("consent")).toBeNull();
    expect(unticked.get("type")).toBe("GENERAL");
    expect(unticked.get("submissionId")).toBe("5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d");
    const ticked = buildContactFormData({ ...values, consent: true } as ContactFormValues, "x", []);
    expect(ticked.get("consent")).toBe("on");
    expect(pristineContactValues("FRAGRANCES", "air-care")).toMatchObject({ type: "FRAGRANCES", application: "air-care" });
  });

  it("reads consent only as on/true and ignores non-string parts", () => {
    const fd = new FormData();
    fd.set("consent", "yes");
    fd.set("type", new File(["FRAGRANCES"], "type.txt"));
    const raw = contactFromFormData(fd);
    expect(raw.consent).toBe(false);
    expect(raw.type).toBeUndefined();
  });
});

describe("message length is bounded before any cleaning", () => {
  it("exports a raw ceiling above the cleaned maximum", () => {
    expect(CONTACT_MESSAGE_RAW_MAX).toBeGreaterThan(CONTACT_MESSAGE_MAX);
  });

  it("rejects an oversized raw message with the length error, not the cleaned-too-short error", () => {
    // Control characters would clean down to an empty string. If cleaning ran first the error would be
    // "at least N characters"; the raw-length check must fire first.
    const r = contactSchema.safeParse(valid({ message: "\u{0}".repeat(CONTACT_MESSAGE_RAW_MAX + 1) }));
    expect(r.success).toBe(false);
    const msg = r.success ? "" : (r.error.issues.find((i) => i.path[0] === "message")?.message ?? "");
    expect(msg).toMatch(/at most/i);
  });

  it("still accepts a message at the cleaned maximum and one with some control characters", () => {
    expect(contactSchema.safeParse(valid({ message: "a".repeat(CONTACT_MESSAGE_MAX) })).success).toBe(true);
    expect(contactSchema.safeParse(valid({ message: `${"a".repeat(50)}\u{0}\u{7}${"b".repeat(50)}` })).success).toBe(true);
  });
});
