import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionButton } from "@/components/ui/action-button";
import { SectionHeader } from "@/components/ui/section-header";
import { ImageFrame } from "@/components/ui/image-frame";

describe("ActionButton", () => {
  it("renders a link when href is given", () => {
    render(<ActionButton href="mailto:a@b.co" variant="primary">Email</ActionButton>);
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:a@b.co");
  });
  it("renders a button when onClick is given", () => {
    render(<ActionButton onClick={() => {}} variant="secondary">Open</ActionButton>);
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("type", "button");
  });
});

describe("SectionHeader", () => {
  it("defaults to h2", () => {
    render(<SectionHeader title="Hello" />);
    expect(screen.getByRole("heading", { level: 2, name: "Hello" })).toBeInTheDocument();
  });
  it("renders h3 when level=3", () => {
    render(<SectionHeader title="Sub" level={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Sub" })).toBeInTheDocument();
  });
});

describe("ImageFrame", () => {
  it("without src renders no img but keeps an accessible name", () => {
    render(<ImageFrame alt="Bakhoor chips" ratio="3/2" />);
    expect(screen.queryByRole("img", { name: "Bakhoor chips" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
  it("with src renders the image with alt", () => {
    render(<ImageFrame alt="Lab glassware" ratio="4/5" src="/x.jpg" />);
    expect(screen.getByAltText("Lab glassware")).toBeInTheDocument();
  });
});
