import { describe, expect, it } from "vitest";
import { parseCategoryName, parseCategoryIntent, parseMoveDirection } from "@/features/categories/schema";

describe("parseCategoryName", () => {
  it("trims and builds a slug", () => {
    expect(parseCategoryName("  Aroma Chemicals  ")).toEqual({ ok: true, name: "Aroma Chemicals", slug: "aroma-chemicals" });
  });

  it("collapses inner whitespace", () => {
    expect(parseCategoryName("Natural   Isolates")).toMatchObject({ ok: true, name: "Natural Isolates" });
  });

  it.each([undefined, null, 5, "", "   "])("rejects a missing or blank name %j", (value) => {
    expect(parseCategoryName(value)).toEqual({ ok: false, error: "Enter a category name." });
  });

  it("rejects a name over 100 characters", () => {
    expect(parseCategoryName("x".repeat(101))).toEqual({ ok: false, error: "Use 100 characters or fewer." });
    expect(parseCategoryName("x".repeat(100))).toMatchObject({ ok: true });
  });

  it("rejects a name with no letters or digits (no usable slug)", () => {
    expect(parseCategoryName("***")).toEqual({ ok: false, error: "Use at least one letter or number." });
  });

  it("strips control characters", () => {
    expect(parseCategoryName("Ethers\u0000\u0007")).toMatchObject({ ok: true, name: "Ethers" });
  });
});

describe("parseCategoryIntent and parseMoveDirection", () => {
  it("accepts only the four intents", () => {
    for (const i of ["create", "rename", "move", "delete"]) expect(parseCategoryIntent(i)).toBe(i);
    for (const i of ["", "drop", "CREATE", null, 1, undefined]) expect(parseCategoryIntent(i)).toBeNull();
  });

  it("accepts only up and down", () => {
    expect(parseMoveDirection("up")).toBe("up");
    expect(parseMoveDirection("down")).toBe("down");
    expect(parseMoveDirection("left")).toBeNull();
  });
});
