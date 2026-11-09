import type { ProductDetail } from "@/features/products/queries";
import { CATALOGUE_PATH, absoluteUrl, productPath } from "./site-url";

type JsonLd = Record<string, unknown>;

/**
 * schema.org Product for a published product. Only fields that exist on the
 * record are emitted; offers, prices, brands and ratings are never invented.
 */
export function productJsonLd(p: ProductDetail, baseUrl: string): object {
  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url: absoluteUrl(baseUrl, productPath(p.slug)),
  };
  if (p.code) ld.sku = p.code;
  if (p.description) ld.description = p.description;
  const categoryName = p.category?.name ?? p.categoryName;
  if (categoryName) ld.category = categoryName;

  const properties: JsonLd[] = [];
  if (p.casNumber) {
    properties.push({ "@type": "PropertyValue", propertyID: "CAS", name: "CAS number", value: p.casNumber });
  }
  for (const s of p.specifications) {
    properties.push({ "@type": "PropertyValue", name: s.label, value: s.value });
  }
  if (properties.length > 0) ld.additionalProperty = properties;
  return ld;
}

export function breadcrumbJsonLd(p: Pick<ProductDetail, "name" | "slug">, baseUrl: string): object {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Aroma chemicals", path: CATALOGUE_PATH },
    { name: p.name, path: productPath(p.slug) },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(baseUrl, c.path),
    })),
  };
}

/**
 * JSON for a <script type="application/ld+json"> body. Escapes `<`, `>`, `&`
 * and the JS line separators so product text can never close the element.
 */
// <, >, & and U+2028/U+2029 (written as escapes so no literal separators sit in the source).
const UNSAFE_IN_SCRIPT = new RegExp("[<>&\\u2028\\u2029]", "g");

export function serializeJsonLd(value: object): string {
  return JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, (c) => {
    return `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}
