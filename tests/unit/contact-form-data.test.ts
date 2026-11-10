import { describe, expect, it } from "vitest";
import { CONTACT_CONFIRMATION_PATH, contactConfirmationHref } from "@/features/contact/confirmation";
import { buildContactFormData, pristineContactValues, type ContactFormValues } from "@/features/contact/form-state";
import { contactFromFormData, contactSchema } from "@/features/contact/schema";
import { ATTACHMENTS_FIELD, HONEYPOT_FIELD } from "@/features/enquiries/schema";

/*
 * The Contact forms build their FormData with buildContactFormData; the server
 * action parses it with contactFromFormData + contactSchema. These tests run
 * the real server parser on what the client builds, so the two cannot drift.
 */

const SUBMISSION_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function values(overrides: Partial<ContactFormValues> = {}): ContactFormValues {
  return {
    type: "FLAVOURS",
    fullName: "TEST Jane Buyer",
    companyName: "TEST Flavour House Ltd",
    email: "jane@testflavour.example",
    phone: "+44 20 7946 0000",
    country: "United Kingdom",
    application: "bakery",
    message: "TEST We would like to discuss a bakery flavour brief.",
    consent: true,
    website: "",
    ...overrides,
  };
}

const parse = (fd: FormData) => contactSchema.safeParse(contactFromFormData(fd));

describe("buildContactFormData", () => {
  it("sends only field names the server parser reads", () => {
    const fd = buildContactFormData(values(), SUBMISSION_ID, [new File(["%PDF-1.4"], "a.pdf")]);
    const serverKeys = [...Object.keys(contactFromFormData(new FormData())), ATTACHMENTS_FIELD];
    const sent = [...new Set(fd.keys())];
    for (const key of sent) expect(serverKeys, key).toContain(key);
    expect(sent).toEqual(
      expect.arrayContaining([
        "type",
        "fullName",
        "companyName",
        "email",
        "phone",
        "country",
        "application",
        "message",
        "submissionId",
        HONEYPOT_FIELD,
        "consent",
        ATTACHMENTS_FIELD,
      ]),
    );
  });

  it("round-trips a flavour enquiry with an application through the server parser", () => {
    const result = parse(buildContactFormData(values(), SUBMISSION_ID, []));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: "FLAVOURS",
      fullName: "TEST Jane Buyer",
      companyName: "TEST Flavour House Ltd",
      email: "jane@testflavour.example",
      phone: "+44 20 7946 0000",
      country: "United Kingdom",
      application: "bakery",
      message: "TEST We would like to discuss a bakery flavour brief.",
      consent: true,
      submissionId: SUBMISSION_ID,
    });
  });

  it("round-trips every contact type from its pristine values", () => {
    for (const type of ["FRAGRANCES", "FLAVOURS", "AROMA_CHEMICALS", "GENERAL"] as const) {
      const v = {
        ...(pristineContactValues(type) as ContactFormValues),
        fullName: "TEST Jane Buyer",
        companyName: "TEST Co",
        email: "jane@testco.example",
        phone: "+44 20 7946 0000",
        country: "India",
        message: "TEST A message long enough.",
        consent: true,
      };
      const result = parse(buildContactFormData(v, SUBMISSION_ID, []));
      expect(result.success, type).toBe(true);
      expect(result.data?.type).toBe(type);
      // "Not specified" is the empty choice and reaches the server as no application.
      expect(result.data?.application).toBeUndefined();
    }
  });

  it("keeps a multi-line message", () => {
    const result = parse(buildContactFormData(values({ message: "TEST line one\nline two" }), SUBMISSION_ID, []));
    expect(result.data?.message).toBe("TEST line one\nline two");
  });

  it("an unticked consent box reaches the server as not consented (a consent field error)", () => {
    const fd = buildContactFormData(values({ consent: false }), SUBMISSION_ID, []);
    expect(fd.get("consent")).toBeNull();
    expect(contactFromFormData(fd).consent).toBe(false);
    const result = parse(fd);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(["consent"]);
  });

  it("sends the honeypot value as-is so the server can discard bot posts", () => {
    const raw = contactFromFormData(buildContactFormData(values({ website: "http://spam.example" }), SUBMISSION_ID, []));
    expect(raw[HONEYPOT_FIELD]).toBe("http://spam.example");
  });

  it("carries the form instance's submissionId, not one from the values", () => {
    const fd = buildContactFormData({ ...values(), submissionId: "ignored" } as ContactFormValues, SUBMISSION_ID, []);
    expect(fd.getAll("submissionId")).toEqual([SUBMISSION_ID]);
  });

  it("appends every attachment under the attachments field", () => {
    const files = [new File(["%PDF-1.4"], "a.pdf"), new File(["x,y"], "b.csv")];
    const fd = buildContactFormData(values(), SUBMISSION_ID, files);
    expect(fd.getAll(ATTACHMENTS_FIELD).map((f) => (f as File).name)).toEqual(["a.pdf", "b.csv"]);
  });

  it("an application from another segment is a field error on application", () => {
    const result = parse(buildContactFormData(values({ type: "FRAGRANCES", application: "bakery" }), SUBMISSION_ID, []));
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(["application"]);
  });
});

describe("contactConfirmationHref", () => {
  it("carries the reference only", () => {
    const href = contactConfirmationHref("AQ-2026-000042");
    expect(href).toBe(`${CONTACT_CONFIRMATION_PATH}?ref=AQ-2026-000042`);
    expect(CONTACT_CONFIRMATION_PATH).toBe("/contact/confirmation");
    expect([...new URL(href, "https://x.test").searchParams.keys()]).toEqual(["ref"]);
  });
});
