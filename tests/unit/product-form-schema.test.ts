import { describe, expect, it } from "vitest";
import {
  PUBLIC_PRODUCT_FIELDS,
  changedProductFields,
  parseProductForm,
  type ProductSnapshot,
} from "@/features/products/form-schema";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

function parsed(entries: Record<string, string>) {
  const result = parseProductForm(form(entries));
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.fieldErrors)}`);
  return result.data;
}

function errors(entries: Record<string, string>) {
  const result = parseProductForm(form(entries));
  if (result.ok) throw new Error("expected errors");
  return result.fieldErrors;
}

describe("parseProductForm", () => {
  it("rejects an empty name", () => {
    expect(errors({ name: "   " }).name).toBe("Name is required");
  });

  it("builds the slug from the name when blank", () => {
    expect(parsed({ name: "Linalyl Acetate (Natural)" }).slug).toBe("linalyl-acetate-natural");
    expect(parsed({ name: "Ethanol", slug: "  My Slug " }).slug).toBe("my-slug");
  });

  it("rejects the reserved slug, however it is reached", () => {
    expect(errors({ name: "x", slug: "documents" }).slug).toMatch(/reserved/);
    expect(errors({ name: "Documents" }).slug).toMatch(/reserved/);
  });

  it("validates CAS and derives casNormalized on the server", () => {
    expect(errors({ name: "x", casNumber: "64-17-4" }).casNumber).toMatch(/Invalid CAS number/);
    const data = parsed({ name: "Ethanol", casNumber: "64-17-5", casNormalized: "999" });
    expect(data.casNumber).toBe("64-17-5");
    expect(data.casNormalized).toBe("64175");
    expect(parsed({ name: "x" }).casNormalized).toBeNull();
  });

  it("accepts a category uuid or empty, rejects anything else", () => {
    const id = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
    expect(parsed({ name: "x", categoryId: id.toUpperCase() }).categoryId).toBe(id);
    expect(parsed({ name: "x", categoryId: "" }).categoryId).toBeNull();
    expect(errors({ name: "x", categoryId: "not-a-uuid" }).categoryId).toBeDefined();
  });

  it("treats blank optional text as null and caps lengths", () => {
    const data = parsed({ name: "x", code: " ", description: "", seoTitle: " T " });
    expect(data.code).toBeNull();
    expect(data.description).toBeNull();
    expect(data.seoTitle).toBe("T");
    expect(errors({ name: "x", description: "a".repeat(10_001) }).description).toMatch(/too long/);
  });

  it("collects specification rows in order and skips fully blank rows", () => {
    const data = parsed({
      name: "x",
      "spec-label-2": "Purity",
      "spec-value-2": "99%",
      "spec-label-0": "Appearance",
      "spec-value-0": "Clear",
      "spec-label-1": " ",
      "spec-value-1": "",
    });
    expect(data.specifications).toEqual([
      { label: "Appearance", value: "Clear" },
      { label: "Purity", value: "99%" },
    ]);
  });

  it("rejects a specification row with a blank label or value", () => {
    expect(errors({ name: "x", "spec-label-0": "", "spec-value-0": "99%" }).specifications).toMatch(/label/);
    expect(errors({ name: "x", "spec-label-0": "Purity", "spec-value-0": "" }).specifications).toMatch(/value/);
  });

  it("rejects more than 100 specification rows", () => {
    const entries: Record<string, string> = { name: "x" };
    for (let i = 0; i < 101; i++) {
      entries[`spec-label-${i}`] = `L${i}`;
      entries[`spec-value-${i}`] = `V${i}`;
    }
    expect(errors(entries).specifications).toMatch(/100/);
    delete entries["spec-label-100"];
    delete entries["spec-value-100"];
    expect(parsed(entries).specifications).toHaveLength(100);
  });

  it("rejects more than 100 applications, skips blanks and repeats", () => {
    const entries: Record<string, string> = { name: "x" };
    for (let i = 0; i < 101; i++) entries[`application-${i}`] = `App ${i}`;
    expect(errors(entries).applications).toMatch(/100/);
    expect(parsed({ name: "x", "application-0": "Soap", "application-1": "", "application-2": "soap", "application-3": "Candles" }).applications).toEqual(["Soap", "Candles"]);
  });

  it("ignores unknown keys, including status, verified and casNormalized", () => {
    const data = parsed({ name: "x", status: "PUBLISHED", verified: "true", casNormalized: "1", publishedAt: "2020-01-01", id: "x" });
    expect(Object.keys(data).sort()).toEqual(
      [
        "applications",
        "casNormalized",
        "casNumber",
        "categoryId",
        "code",
        "description",
        "name",
        "seoDescription",
        "seoTitle",
        "slug",
        "sourceNote",
        "specifications",
      ].sort(),
    );
    expect(data.casNormalized).toBeNull();
  });
});

describe("changedProductFields / PUBLIC_PRODUCT_FIELDS", () => {
  const base: ProductSnapshot = {
    name: "A",
    slug: "a",
    code: null,
    casNumber: null,
    categoryId: null,
    description: null,
    seoTitle: null,
    seoDescription: null,
    sourceNote: null,
    specifications: [{ label: "L", value: "V" }],
    applications: ["X"],
  };

  it("reports only fields that differ", () => {
    expect(changedProductFields(base, { ...base })).toEqual([]);
    expect(changedProductFields(base, { ...base, description: "d", sourceNote: "n" })).toEqual(["description", "sourceNote"]);
    expect(changedProductFields(base, { ...base, specifications: [{ label: "L", value: "W" }], applications: ["X", "Y"] })).toEqual([
      "specifications",
      "applications",
    ]);
  });

  it("covers every field except the source note", () => {
    expect(PUBLIC_PRODUCT_FIELDS).not.toContain("sourceNote");
    expect(PUBLIC_PRODUCT_FIELDS).toEqual(expect.arrayContaining(["name", "slug", "code", "casNumber", "categoryId", "description", "seoTitle", "seoDescription", "specifications", "applications"]));
    expect(PUBLIC_PRODUCT_FIELDS).toHaveLength(10);
  });
});
