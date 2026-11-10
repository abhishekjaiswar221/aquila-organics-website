import { findApplication } from "@/content/segments";

/**
 * True only for a one-segment URL under /fragrances or /flavours whose slug is NOT one of the
 * eleven fixed application slugs. Used by src/proxy.ts to answer a real 404 status before
 * rendering. Pure and database-free; everything that is not such a URL returns false.
 * A slug that cannot be percent-decoded counts as unknown.
 */
export function isUnknownApplicationPath(pathname: string): boolean {
  const parts = pathname.split("/");
  if (parts.length !== 3 || parts[0] !== "") return false;
  const [, segment, raw] = parts;
  if (segment !== "fragrances" && segment !== "flavours") return false;
  if (raw === "") return false;
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return true;
  }
  return findApplication(segment, slug) === undefined;
}
