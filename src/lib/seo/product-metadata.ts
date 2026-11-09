import type { Metadata } from "next";
import type { ProductDetail } from "@/features/products/queries";
import { productPath } from "./site-url";

const MAX_DESCRIPTION = 160;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}\u{2026}`;
}

/** Title and description from the SEO fields, or built from existing fields only. */
export function productMetadata(p: ProductDetail): Metadata {
  const title = p.seoTitle?.trim() || (p.casNumber ? `${p.name} (CAS ${p.casNumber})` : p.name);
  let description = p.seoDescription?.trim();
  if (!description && p.description) description = truncate(p.description, MAX_DESCRIPTION);
  if (!description) {
    const ids = [p.code ? `product code ${p.code}` : null, p.casNumber ? `CAS ${p.casNumber}` : null]
      .filter(Boolean)
      .join(", ");
    description = `${p.name}${ids ? ` (${ids})` : ""}: aroma chemical from Aquila Organics. Request a quotation.`;
  }
  return {
    title,
    description,
    alternates: { canonical: productPath(p.slug) },
    robots: { index: true, follow: true },
  };
}
