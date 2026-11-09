/**
 * Public base URL of the site, used for canonical URLs, JSON-LD and the
 * sitemap. NEXT_PUBLIC_SITE_URL is inlined at build time; the fallback matches
 * the root layout's metadataBase.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Joins a base URL and an absolute path without doubling slashes. */
export function absoluteUrl(base: string, pathname: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export const CATALOGUE_PATH = "/aroma-chemicals";
export const PRIVACY_PATH = "/privacy";

export function productPath(slug: string): string {
  return `${CATALOGUE_PATH}/${encodeURIComponent(slug)}`;
}
