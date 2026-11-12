import type { MetadataRoute } from "next";
import { APPLICATION_SLUGS, applicationPath, flavourSegment, fragranceSegment } from "@/content/segments";
import { CAREERS_PATH, jobPath } from "@/features/careers/paths";
import { CATALOGUE_PATH, PRIVACY_PATH, absoluteUrl, productPath } from "./site-url";

export type SitemapProduct = { slug: string; lastModified: Date };

export type SitemapOptions = {
  /** List /sustainability/certifications only once it shows at least one confirmed certificate. */
  certificationsIndexable?: boolean;
  /** Currently public job openings; /careers itself is always listed. */
  jobs?: readonly SitemapJob[];
};

export type SitemapJob = { slug: string; lastModified: Date };

/** Company and sustainability pages: static content, always indexable (certifications is conditional). */
function companyEntries(baseUrl: string, options: SitemapOptions): MetadataRoute.Sitemap {
  const paths = ["/about", "/innovation", "/sustainability", "/sustainability/compliance"];
  if (options.certificationsIndexable) paths.push("/sustainability/certifications");
  paths.push("/contact");
  return paths.map((path) => ({
    url: absoluteUrl(baseUrl, path),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

/** Segment overviews and every application page: static content, always indexable. */
function segmentEntries(baseUrl: string): MetadataRoute.Sitemap {
  return [fragranceSegment, flavourSegment].flatMap((segment) => [
    { url: absoluteUrl(baseUrl, segment.path), changeFrequency: "monthly" as const, priority: 0.8 },
    ...APPLICATION_SLUGS[segment.id].map((slug) => ({
      url: absoluteUrl(baseUrl, applicationPath(segment.id, slug)),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ]);
}

/** Public, indexable URLs only: homepage, catalogue, segment pages, published products, privacy notice. */
export function buildSitemap(
  baseUrl: string,
  products: readonly SitemapProduct[],
  options: SitemapOptions = {},
): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl(baseUrl, "/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl(baseUrl, CATALOGUE_PATH), changeFrequency: "weekly", priority: 0.8 },
    ...segmentEntries(baseUrl),
    ...companyEntries(baseUrl, options),
    ...products.map((p) => ({
      url: absoluteUrl(baseUrl, productPath(p.slug)),
      lastModified: p.lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: absoluteUrl(baseUrl, CAREERS_PATH), changeFrequency: "weekly", priority: 0.5 },
    ...(options.jobs ?? []).map((j) => ({
      url: absoluteUrl(baseUrl, jobPath(j.slug)),
      lastModified: j.lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    { url: absoluteUrl(baseUrl, PRIVACY_PATH), changeFrequency: "yearly", priority: 0.2 },
  ];
}

/**
 * robots.txt. With `noindex` (the DEMO_NOINDEX=1 setting on a demo deployment) the whole site is disallowed
 * and no sitemap is offered, so a shared demo link cannot end up in search results.
 */
export function robotsConfig(baseUrl: string, options: { noindex?: boolean } = {}): MetadataRoute.Robots {
  if (options.noindex) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: absoluteUrl(baseUrl, "/sitemap.xml"),
  };
}
