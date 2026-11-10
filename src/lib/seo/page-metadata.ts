import type { Metadata } from "next";
import { addresses, company, contacts } from "@/content/site";
import { absoluteUrl } from "./site-url";

export interface PageMetadataInput {
  title: string;
  description: string;
  /** Absolute path, e.g. "/about". Becomes the canonical (resolved against metadataBase). */
  path: string;
  noindex?: boolean;
}

export function buildPageMetadata({ title, description, path, noindex = false }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: !noindex, follow: true },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** BreadcrumbList for a page trail (home first). Serialise with `serializeJsonLd`. */
export function pageBreadcrumbJsonLd(trail: readonly Crumb[], baseUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(baseUrl, crumb.path),
    })),
  };
}

/**
 * Organization data from verified site details only. Deliberately omits founding date,
 * employee count, social profiles, logo, awards and ratings: none is confirmed.
 */
export function organizationJsonLd(baseUrl: string): object {
  const postal = (lines: readonly string[]) => ({
    "@type": "PostalAddress",
    streetAddress: lines.join(", "),
    addressCountry: "IN",
  });
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: baseUrl,
    address: [postal(addresses.headOffice.lines), postal(addresses.registeredOffice.lines)],
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", email: contacts.general }],
  };
}
