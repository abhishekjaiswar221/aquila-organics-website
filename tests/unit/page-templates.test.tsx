import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ApplicationPage } from "@/components/pages/application-page";
import { Breadcrumbs } from "@/components/pages/breadcrumbs";
import { CertificationsPage } from "@/components/pages/certifications-page";
import { ContentPage } from "@/components/pages/content-page";
import { PageSections } from "@/components/pages/page-sections";
import { SegmentPage } from "@/components/pages/segment-page";
import { consultationHref, fragranceSegment, flavourSegment } from "@/content/segments";
import type { ApplicationRecord, Block, CertificateRecord, PageSection } from "@/content/types";

const sec = (id: string, status: Block<PageSection>["status"], data: PageSection): Block<PageSection> => ({
  id,
  status,
  data,
});

const headingLevels = (root: HTMLElement): number[] =>
  Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => Number(h.tagName[1]));

const noSkips = (levels: number[]): boolean => levels.every((l, i) => i === 0 || l - levels[i - 1] <= 1);

describe("PageSections", () => {
  it("never renders hidden blocks but renders the other statuses", () => {
    render(
      <PageSections
        blocks={[
          sec("a", "hidden", { kind: "paragraphs", paragraphs: ["SECRET-HIDDEN"] }),
          sec("b", "verified", { kind: "paragraphs", paragraphs: ["SHOWN-VERIFIED"] }),
          sec("c", "needs-client-confirmation", { kind: "paragraphs", paragraphs: ["SHOWN-PENDING"] }),
        ]}
      />,
    );
    expect(screen.queryByText("SECRET-HIDDEN")).toBeNull();
    expect(screen.getByText("SHOWN-VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("SHOWN-PENDING")).toBeInTheDocument();
  });

  it("renders lists with a heading and quotes as an aside", () => {
    render(
      <PageSections
        blocks={[
          sec("l", "verified", { kind: "list", heading: "Things", items: ["One", "Two"] }),
          sec("q", "brief-supplied", { kind: "quote", eyebrow: "Note", text: "Quoted words" }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Things" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["One", "Two"]);
    expect(screen.getByText("Quoted words").closest("aside")).not.toBeNull();
  });
});

describe("Breadcrumbs", () => {
  it("is a labelled nav and marks only the last item as the current page", () => {
    render(
      <Breadcrumbs
        trail={[
          { name: "Home", path: "/" },
          { name: "Fragrances", path: "/fragrances" },
          { name: "Air Care", path: "/fragrances/air-care" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/fragrances"]);
    expect(within(nav).getByText("Air Care")).toHaveAttribute("aria-current", "page");
  });
});

describe("ApplicationPage", () => {
  const minimal: ApplicationRecord = { slug: "air-care", name: "Air Care", summary: "Fragrances for air fresheners.", blocks: [] };

  it("with only a summary renders the h1, the summary, the CTA and no empty section headings", () => {
    const { container } = render(<ApplicationPage segment={fragranceSegment} application={minimal} />);
    expect(screen.getByRole("heading", { level: 1, name: "Air Care" })).toBeInTheDocument();
    expect(screen.getByText("Fragrances for air fresheners.")).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    const cta = screen.getByRole("link", { name: /request a consultation/i });
    expect(cta).toHaveAttribute("href", "/contact?type=FRAGRANCES&application=air-care");
    expect(noSkips(headingLevels(container))).toBe(true);
  });

  it("uses the flavours consultation type for flavour applications", () => {
    render(
      <ApplicationPage
        segment={flavourSegment}
        application={{ slug: "bakery", name: "Bakery", summary: "Baked goods.", blocks: [] }}
      />,
    );
    expect(screen.getByRole("link", { name: /request a consultation/i })).toHaveAttribute(
      "href",
      "/contact?type=FLAVOURS&application=bakery",
    );
  });

  it("links back to the parent segment through the breadcrumb", () => {
    render(<ApplicationPage segment={fragranceSegment} application={minimal} />);
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(nav).getByRole("link", { name: "Fragrances" })).toHaveAttribute("href", "/fragrances");
  });
});

describe("SegmentPage", () => {
  it("lists every application as a link to its own page without skipping heading levels", () => {
    const { container } = render(<SegmentPage segment={fragranceSegment} />);
    expect(screen.getByRole("heading", { level: 1, name: "Fragrances" })).toBeInTheDocument();
    for (const a of fragranceSegment.applications) {
      expect(screen.getByRole("link", { name: new RegExp(a.name) })).toHaveAttribute(
        "href",
        `/fragrances/${a.slug}`,
      );
    }
    expect(noSkips(headingLevels(container))).toBe(true);
  });

  it("renders segment extras (the flavours shisha line) and hides nothing hidden", () => {
    render(<SegmentPage segment={flavourSegment} />);
    expect(screen.getByText(/shisha/i)).toBeInTheDocument();
  });
});

describe("ContentPage", () => {
  it("renders one h1 and only h2 section headings", () => {
    const { container } = render(
      <ContentPage
        title="About"
        lead="Lead text"
        path="/about"
        blocks={[sec("p", "verified", { kind: "list", heading: "Regions", items: ["India"] })]}
      />,
    );
    expect(headingLevels(container)).toEqual([1, 2]);
  });
});

describe("CertificationsPage", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const c = (over: Partial<CertificateRecord>): CertificateRecord => ({
    id: "x",
    title: "TEST-Cert",
    issuer: "TEST-Issuer",
    issuedOn: "2025-01-01",
    expiresOn: "2027-01-01",
    scope: "TEST-scope",
    documentPath: null,
    status: "verified",
    ...over,
  });

  it("with no entries shows only the pending message and no expired heading", () => {
    render(<CertificationsPage certificates={[]} now={now} pending="Being compiled." />);
    expect(screen.getByText("Being compiled.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /expired/i })).toBeNull();
  });

  it("shows an active entry with issuer, dates and scope, and a document link only when one exists", () => {
    render(
      <CertificationsPage
        certificates={[c({ id: "a", documentPath: "/docs/a.pdf" }), c({ id: "b", title: "TEST-NoDoc" })]}
        now={now}
        pending="p"
      />,
    );
    expect(screen.getByText("TEST-Cert")).toBeInTheDocument();
    expect(screen.getAllByText(/TEST-Issuer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 January 2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TEST-scope/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /document|download|view/i })).toHaveLength(1);
    expect(screen.queryByText("Being compiled.")).toBeNull();
  });

  it("lists an expired entry only under an Expired heading, never as current", () => {
    render(
      <CertificationsPage
        certificates={[c({ id: "old", title: "TEST-Old", expiresOn: "2026-11-09" })]}
        now={now}
        pending="Being compiled."
      />,
    );
    const heading = screen.getByRole("heading", { name: /expired/i });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^(current|active|valid)/i })).toBeNull();
    expect(screen.getByText("TEST-Old")).toBeInTheDocument();
    expect(screen.getByText("Being compiled.")).toBeInTheDocument();
  });

  it("never renders an unconfirmed entry", () => {
    render(
      <CertificationsPage
        certificates={[c({ id: "u", title: "TEST-Unconfirmed", status: "needs-client-confirmation" })]}
        now={now}
        pending="Being compiled."
      />,
    );
    expect(screen.queryByText("TEST-Unconfirmed")).toBeNull();
    expect(screen.getByText("Being compiled.")).toBeInTheDocument();
  });
});

describe("consultationHref", () => {
  it("builds the Contact deep link for a segment and application", () => {
    expect(consultationHref("fragrances", "fine-fragrance")).toBe("/contact?type=FRAGRANCES&application=fine-fragrance");
    expect(consultationHref("flavours", "dairy")).toBe("/contact?type=FLAVOURS&application=dairy");
    expect(consultationHref("flavours")).toBe("/contact?type=FLAVOURS");
  });
});
