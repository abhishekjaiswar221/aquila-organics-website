import { describe, expect, it } from "vitest";
import { enquiryMessageLabel, showProductsSection } from "@/features/enquiries/display";

describe("admin enquiry display", () => {
  it("labels the free-text field Message when the enquiry has no product lines (a contact message)", () => {
    expect(enquiryMessageLabel(0)).toBe("Message");
  });

  it("keeps Additional requirements for a quotation request with product lines", () => {
    expect(enquiryMessageLabel(1)).toBe("Additional requirements");
    expect(enquiryMessageLabel(7)).toBe("Additional requirements");
  });

  it("shows the products section only when there are lines", () => {
    expect(showProductsSection(0)).toBe(false);
    expect(showProductsSection(2)).toBe(true);
  });
});
