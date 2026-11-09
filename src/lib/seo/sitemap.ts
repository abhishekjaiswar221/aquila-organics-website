import type { MetadataRoute } from "next";
import { CATALOGUE_PATH, PRIVACY_PATH, absoluteUrl, productPath } from "./site-url";

export type SitemapProduct = { slug: string; lastModified: Date };

/** Public, indexable URLs only: homepage, catalogue, published products, privacy notice. */
export function buildSitemap(baseUrl: string, products: readonly SitemapProduct[]): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl(baseUrl, "/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl(baseUrl, CATALOGUE_PATH), changeFrequency: "weekly", priority: 0.8 },
    ...products.map((p) => ({
      url: absoluteUrl(baseUrl, productPath(p.slug)),
      lastModified: p.lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: absoluteUrl(baseUrl, PRIVACY_PATH), changeFrequency: "yearly", priority: 0.2 },
  ];
}

export function robotsConfig(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: absoluteUrl(baseUrl, "/sitemap.xml"),
  };
}
