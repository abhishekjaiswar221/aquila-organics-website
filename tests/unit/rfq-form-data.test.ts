import { describe, expect, it } from "vitest";
import {
  buildRfqFormData,
  catalogueLine,
  checkSelectedFiles,
  emptyLine,
  type RfqFormValues,
} from "@/features/enquiries/form-state";
import { rfqFromFormData, rfqSchema } from "@/features/enquiries/schema";
import { MAX_ATTACHMENT_BYTES } from "@/features/enquiries/attachment-rules";

const PRODUCT_ID = "e2e00000-0000-4000-8000-000000000001";
const SUBMISSION_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function values(overrides: Partial<RfqFormValues> = {}): RfqFormValues {
  return {
    fullName: "TEST Jane Buyer",
    companyName: "TEST Fragrance House Ltd",
    email: "jane@testfragrance.example",
    phone: "+44 20 7946 0000",
    country: "United Kingdom",
    businessSegment: "FRAGRANCES",
    intendedApplication: "TEST fine fragrance",
    additionalRequirements: "",
    consent: true,
    website: "",
    items: [
      { ...catalogueLine({ id: PRODUCT_ID, name: "TEST-Ethanol" }), quantity: "25", unit: "KG", notes: "Drums" },
      { ...emptyLine(), name: "TEST Custom blend", quantity: "1.5", unit: "L" },
    ],
    ...overrides,
  };
}

describe("buildRfqFormData", () => {
  it("uses exactly the field names the server parser reads", () => {
    const fd = buildRfqFormData(values(), SUBMISSION_ID, []);
    const keys = [...fd.keys()];
    expect(keys).toEqual(
      expect.arrayContaining([
        "fullName",
        "companyName",
        "email",
        "phone",
        "country",
        "businessSegment",
        "intendedApplication",
        "submissionId",
        "website",
        "consent",
        "items.0.productId",
        "items.0.name",
        "items.0.quantity",
        "items.0.unit",
        "items.0.notes",
        "items.1.name",
        "items.1.quantity",
        "items.1.unit",
      ]),
    );
    // A free-text line carries no product id.
    expect(keys).not.toContain("items.1.productId");
    expect(fd.get("submissionId")).toBe(SUBMISSION_ID);
    expect(fd.get("consent")).toBe("on");
  });

  it("round-trips through the server's rfqFromFormData + rfqSchema", () => {
    const parsed = rfqSchema.parse(rfqFromFormData(buildRfqFormData(values(), SUBMISSION_ID, [])));
    expect(parsed).toMatchObject({
      fullName: "TEST Jane Buyer",
      email: "jane@testfragrance.example",
      businessSegment: "FRAGRANCES",
      consent: true,
      submissionId: SUBMISSION_ID,
      additionalRequirements: undefined,
    });
    expect(parsed.items).toEqual([
      { productId: PRODUCT_ID, name: "TEST-Ethanol", quantity: 25, unit: "KG", notes: "Drums" },
      { productId: undefined, name: "TEST Custom blend", quantity: 1.5, unit: "L", notes: undefined },
    ]);
  });

  it("sends the honeypot value as-is so the server can discard bot posts", () => {
    const raw = rfqFromFormData(buildRfqFormData(values({ website: "http://spam.example" }), SUBMISSION_ID, []));
    expect(raw.website).toBe("http://spam.example");
  });

  it("an unticked consent box reaches the server as not consented", () => {
    const raw = rfqFromFormData(buildRfqFormData(values({ consent: false as never }), SUBMISSION_ID, []));
    expect(raw.consent).toBe(false);
  });

  it("appends every attachment under the attachments field", () => {
    const files = [new File(["%PDF-1.4"], "a.pdf"), new File(["x,y"], "b.csv")];
    const fd = buildRfqFormData(values(), SUBMISSION_ID, files);
    expect(fd.getAll("attachments").map((f) => (f as File).name)).toEqual(["a.pdf", "b.csv"]);
  });
});

describe("checkSelectedFiles", () => {
  const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

  it("accepts allowed types and reports others by name", () => {
    const out = checkSelectedFiles([], [file("spec.pdf"), file("photo.JPG"), file("virus.exe")]);
    expect(out.accepted.map((f) => f.name)).toEqual(["spec.pdf", "photo.JPG"]);
    expect(out.errors).toEqual(["virus.exe: this file type is not accepted"]);
  });

  it("rejects files over 10 MB", () => {
    const big = { name: "big.pdf", size: MAX_ATTACHMENT_BYTES + 1, lastModified: 0 } as File;
    const out = checkSelectedFiles([], [big]);
    expect(out.accepted).toEqual([]);
    expect(out.errors).toEqual(["big.pdf: larger than 10 MB"]);
  });

  it("keeps at most five files in total", () => {
    const existing = [file("1.pdf"), file("2.pdf"), file("3.pdf"), file("4.pdf")];
    const out = checkSelectedFiles(existing, [file("5.pdf"), file("6.pdf")]);
    expect(out.accepted.map((f) => f.name)).toEqual(["5.pdf"]);
    expect(out.errors).toEqual(["You can attach up to 5 files. Not added: 6.pdf"]);
  });

  it("ignores a file that is already in the list", () => {
    const a = file("a.pdf");
    const out = checkSelectedFiles([a], [a]);
    expect(out.accepted).toEqual([]);
    expect(out.errors).toEqual([]);
  });
});
