import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfirmationPage from "@/app/(public)/rfq/confirmation/page";

async function renderPage(ref?: string) {
  const ui = await ConfirmationPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(ref === undefined ? {} : { ref }),
  });
  return render(ui);
}

describe("RFQ confirmation page copy", () => {
  // A per-recipient cap may skip the acknowledgement, so the page must not promise one.
  it("says an acknowledgement normally follows by email, without promising it", async () => {
    await renderPage("AQ-2026-000001");
    expect(screen.getByTestId("enquiry-reference")).toHaveTextContent("AQ-2026-000001");
    const main = document.body.textContent ?? "";
    expect(main).toContain("you will normally receive an acknowledgement by email");
    expect(main).not.toMatch(/you should receive an acknowledgement/i);
  });
});
