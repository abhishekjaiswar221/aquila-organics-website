import { describe, expect, it } from "vitest";
import { parseContactParams } from "@/features/contact/query-params";
import { consultationHref } from "@/content/segments";

describe("parseContactParams", () => {
  it("returns nothing for an empty query", () => {
    expect(parseContactParams({})).toEqual({});
  });

  it("keeps a valid type and application pair", () => {
    expect(parseContactParams({ type: "FRAGRANCES", application: "fine-fragrance" })).toEqual({
      type: "FRAGRANCES",
      application: "fine-fragrance",
    });
    expect(parseContactParams({ type: "FLAVOURS", application: "bakery" })).toEqual({
      type: "FLAVOURS",
      application: "bakery",
    });
    expect(parseContactParams({ type: "GENERAL" })).toEqual({ type: "GENERAL" });
    expect(parseContactParams({ type: "AROMA_CHEMICALS" })).toEqual({ type: "AROMA_CHEMICALS" });
  });

  it("uses only the first value of a repeated key, and only if it is valid", () => {
    expect(parseContactParams({ type: ["FLAVOURS", "FRAGRANCES"] })).toEqual({ type: "FLAVOURS" });
    expect(parseContactParams({ type: ["a", "b"] })).toEqual({});
    expect(parseContactParams({ type: ["a", "FRAGRANCES"] })).toEqual({});
    expect(parseContactParams({ type: [] })).toEqual({});
    expect(parseContactParams({ type: "FRAGRANCES", application: ["bogus", "fine-fragrance"] })).toEqual({
      type: "FRAGRANCES",
    });
    expect(parseContactParams({ type: "FRAGRANCES", application: ["air-care", "bogus"] })).toEqual({
      type: "FRAGRANCES",
      application: "air-care",
    });
  });

  it("drops unknown, privileged, lowercase and over-long values", () => {
    for (const type of ["CAREERS", "ADMIN", "fragrances", "", " FRAGRANCES", "x".repeat(500), "FRAGRANCES".repeat(50)]) {
      expect(parseContactParams({ type }), type.slice(0, 20)).toEqual({});
    }
    expect(parseContactParams({ type: "FRAGRANCES", application: "x".repeat(500) })).toEqual({ type: "FRAGRANCES" });
    expect(parseContactParams({ type: "FRAGRANCES", application: "<script>alert(1)</script>" })).toEqual({
      type: "FRAGRANCES",
    });
  });

  it("drops an application that does not belong to the type, or that has no type", () => {
    expect(parseContactParams({ type: "FLAVOURS", application: "fine-fragrance" })).toEqual({ type: "FLAVOURS" });
    expect(parseContactParams({ type: "FRAGRANCES", application: "FINE-FRAGRANCE" })).toEqual({ type: "FRAGRANCES" });
    expect(parseContactParams({ type: "AROMA_CHEMICALS", application: "fine-fragrance" })).toEqual({
      type: "AROMA_CHEMICALS",
    });
    expect(parseContactParams({ type: "GENERAL", application: "bakery" })).toEqual({ type: "GENERAL" });
    expect(parseContactParams({ application: "bakery" })).toEqual({});
  });

  it("ignores unrelated keys", () => {
    expect(parseContactParams({ type: "GENERAL", status: "WON", website: "x", utm_source: undefined })).toEqual({
      type: "GENERAL",
    });
  });

  it("accepts every consultation link the application pages generate", () => {
    const url = new URL(consultationHref("fragrances", "incense-and-bakhoor"), "https://example.test");
    expect(parseContactParams(Object.fromEntries(url.searchParams))).toEqual({
      type: "FRAGRANCES",
      application: "incense-and-bakhoor",
    });
    const plain = new URL(consultationHref("flavours"), "https://example.test");
    expect(parseContactParams(Object.fromEntries(plain.searchParams))).toEqual({ type: "FLAVOURS" });
  });
});
