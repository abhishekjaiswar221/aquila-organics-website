import { NextResponse, type NextRequest } from "next/server";
import { isPublishedSlug } from "@/features/products/queries";

/*
 * Real 404 status for unknown, draft and archived product slugs.
 *
 * With Cache Components and Partial Prefetching, /aroma-chemicals/[slug] is
 * served as an App Shell (layouts) that streams before the page renders, so a
 * notFound() in the page could only produce a 200 with noindex. Checking the
 * slug here, before rendering, lets an unpublished slug be rewritten to an
 * unmatched path, which Next.js answers with the root not-found page and a 404.
 * The page keeps its own notFound() as a second line of defence.
 */
export async function proxy(request: NextRequest) {
  // Router prefetches only fetch the generic App Shell: no lookup needed.
  if (request.headers.has("next-router-prefetch")) return NextResponse.next();

  const raw = request.nextUrl.pathname.split("/")[2] ?? "";
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    slug = "";
  }
  if (slug && (await isPublishedSlug(slug))) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_catalogue/not-found", request.url));
}

export const config = {
  // One segment below the catalogue: product pages only (documents/[id] is two segments).
  matcher: "/aroma-chemicals/:slug",
};
