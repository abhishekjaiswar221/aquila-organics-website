import { describe, expect, it } from "vitest";
import { isUnknownApplicationPath } from "@/features/pages/application-guard";

describe("isUnknownApplicationPath", () => {
  it("lets all eleven known application pages through", () => {
    for (const p of [
      "/fragrances/fine-fragrance",
      "/fragrances/personal-care",
      "/fragrances/air-care",
      "/fragrances/fabric-care",
      "/fragrances/home-care",
      "/fragrances/incense-and-bakhoor",
      "/flavours/confectionery",
      "/flavours/bakery",
      "/flavours/beverages",
      "/flavours/dairy",
      "/flavours/savoury",
    ]) {
      expect(isUnknownApplicationPath(p), p).toBe(false);
    }
  });

  it("flags unknown, wrongly cased, cross-segment and hostile slugs", () => {
    for (const p of [
      "/fragrances/nope",
      "/fragrances/Fine-Fragrance",
      "/fragrances/bakery",
      "/flavours/air-care",
      "/flavours/FINE",
      "/fragrances/%00",
      "/fragrances/%E0%A4%A",
      "/flavours/bakery%20",
      "/fragrances/air%2Dcare%2F",
      "/fragrances/..",
    ]) {
      expect(isUnknownApplicationPath(p), p).toBe(true);
    }
  });

  it("accepts a percent-encoded form of a known slug", () => {
    expect(isUnknownApplicationPath("/fragrances/air%2Dcare")).toBe(false);
  });

  it("ignores every path that is not a one-segment application URL", () => {
    for (const p of [
      "/",
      "/fragrances",
      "/flavours",
      "/fragrances/",
      "/fragrances/air-care/extra",
      "/aroma-chemicals/nope",
      "/about",
      "/admin/products",
      "/fragrance/nope",
    ]) {
      expect(isUnknownApplicationPath(p), p).toBe(false);
    }
  });
});
