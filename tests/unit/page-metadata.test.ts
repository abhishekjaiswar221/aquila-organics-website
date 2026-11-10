import { describe, expect, it } from "vitest";
import {
  buildPageMetadata,
  organizationJsonLd,
  pageBreadcrumbJsonLd,
} from "@/lib/seo/page-metadata";
import { serializeJsonLd } from "@/lib/seo/product-jsonld";
import { addresses, contacts } from "@/content/site";

const BASE = "https://example.test";

describe("buildPageMetadata", () => {
  it("sets title, description and a canonical path, indexable by default", () => {
    const m = buildPageMetadata({ title: "About", description: "About us", path: "/about" });
    expect(m.title).toBe("About");
    expect(m.description).toBe("About us");
    expect(m.alternates?.canonical).toBe("/about");
    expect(m.robots).toEqual({ index: true, follow: true });
  });

  it("marks noindex pages as noindex,follow while keeping the canonical", () => {
    const m = buildPageMetadata({
      title: "Certifications",
      description: "d",
      path: "/sustainability/certifications",
      noindex: true,
    });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBe("/sustainability/certifications");
  });
});

describe("pageBreadcrumbJsonLd", () => {
  it("numbers the trail from 1 with absolute URLs", () => {
    const ld = pageBreadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "Fragrances", path: "/fragrances" },
        { name: "Air Care", path: "/fragrances/air-care" },
      ],
      BASE,
    ) as { "@type": string; itemListElement: { position: number; name: string; item: string }[] };
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(ld.itemListElement[2]).toMatchObject({ name: "Air Care", item: `${BASE}/fragrances/air-care` });
  });

  it("survives a hostile name through the shared serializer", () => {
    const ld = pageBreadcrumbJsonLd([{ name: "</script><script>alert(1)</script>", path: "/x" }], BASE);
    const out = serializeJsonLd(ld);
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).itemListElement[0].name).toBe("</script><script>alert(1)</script>");
  });
});

describe("organizationJsonLd", () => {
  const ld = organizationJsonLd(BASE) as Record<string, unknown>;

  it("names the company and both offices from the verified site data", () => {
    expect(ld["@type"]).toBe("Organization");
    expect(ld.name).toBe("Aquila Organics Private Limited");
    expect(ld.url).toBe(BASE);
    const text = JSON.stringify(ld);
    expect(text).toContain(addresses.headOffice.lines[0]);
    expect(text).toContain(addresses.registeredOffice.lines[0]);
    expect(text).toContain(contacts.general);
  });

  it("claims nothing unconfirmed: no founding date, headcount, profiles, logo or awards", () => {
    for (const key of ["foundingDate", "numberOfEmployees", "sameAs", "logo", "award", "aggregateRating"]) {
      expect(ld).not.toHaveProperty(key);
    }
  });
});
