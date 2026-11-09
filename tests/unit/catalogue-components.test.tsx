import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogueEmptyState } from "@/components/catalogue/empty-state";
import { contacts } from "@/content/site";

// The "nothing published yet" state is tested here rather than in e2e: the
// e2e database always has published fixtures, and toggling it per test would
// race the parallel Playwright workers. The page decides which state to show
// with catalogueView(), unit-tested in catalogue-params.test.ts.
describe("CatalogueEmptyState", () => {
  it("says the catalogue is being prepared and offers real contact routes", () => {
    render(<CatalogueEmptyState />);
    expect(screen.getByRole("heading", { level: 2, name: /catalogue is being prepared/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: contacts.sales })).toHaveAttribute("href", `mailto:${contacts.sales}`);
    expect(screen.getByRole("link", { name: contacts.phoneAromaChemicals.display })).toHaveAttribute(
      "href",
      `tel:${contacts.phoneAromaChemicals.tel}`,
    );
  });

  it("renders no product rows", () => {
    const { container } = render(<CatalogueEmptyState />);
    expect(container.querySelectorAll("li, tr")).toHaveLength(0);
  });
});
