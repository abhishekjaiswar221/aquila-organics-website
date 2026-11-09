import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnquiryLink } from "@/components/layout/enquiry-link";
import { ENQUIRY_LIST_KEY, addProduct, resetMemoryForTests } from "@/features/enquiries/store-client";

const A = "e2e00000-0000-4000-8000-000000000001";
const B = "e2e00000-0000-4000-8000-000000000002";

beforeEach(() => {
  window.localStorage.clear();
  resetMemoryForTests();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("EnquiryLink", () => {
  it("server HTML is a plain Enquiry link to /rfq with no count, whatever is stored", () => {
    window.localStorage.setItem(ENQUIRY_LIST_KEY, JSON.stringify([A, B]));
    const html = renderToString(<EnquiryLink />);
    expect(html).toContain('href="/rfq"');
    expect(html).toContain(">Enquiry<");
    expect(html).not.toMatch(/\(\d+\)/);
    expect(html).toContain('aria-label="Enquiry list"');
  });

  it("after mount shows the stored count in text and accessible name", () => {
    window.localStorage.setItem(ENQUIRY_LIST_KEY, JSON.stringify([A, B]));
    render(<EnquiryLink />);
    const link = screen.getByRole("link", { name: "Enquiry list, 2 products" });
    expect(link).toHaveAttribute("href", "/rfq");
    expect(link).toHaveTextContent("Enquiry (2)");
  });

  it("updates when a product is added", () => {
    render(<EnquiryLink />);
    expect(screen.getByRole("link", { name: "Enquiry list" })).toHaveTextContent(/^Enquiry$/);
    act(() => addProduct(A));
    expect(screen.getByRole("link", { name: "Enquiry list, 1 product" })).toHaveTextContent("Enquiry (1)");
  });
});
