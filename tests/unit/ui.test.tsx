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
  it("without a slot renders no img but keeps an accessible name", () => {
    render(<ImageFrame alt="Bakhoor chips" ratio="3/2" />);
    expect(screen.queryByRole("img", { name: "Bakhoor chips" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
  it("with a slot that has no registered photo (manufacturing) stays a placeholder", () => {
    render(<ImageFrame slot="manufacturing" alt="Manufacturing placeholder" ratio="3/2" />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Manufacturing placeholder" })).toBeInTheDocument();
  });
  it("with a registered slot renders the photo using the registered alt text, not the placeholder alt", () => {
    render(<ImageFrame slot="hero" alt="Placeholder alt" ratio="4/5" />);
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toMatch(/amber glass bottles/i);
    expect(screen.queryByRole("img", { name: "Placeholder alt" })).toBeNull();
  });
});
