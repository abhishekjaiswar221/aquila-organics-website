import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { adminRedirectTarget, isAdminPath, isPrefetchRequest } from "@/features/admin/proxy-redirect";
import { isUnknownApplicationPath } from "@/features/pages/application-guard";

const PRODUCT_PREFIX = "/aroma-chemicals/";

/*
 * Two independent branches, chosen by path; neither ever runs the other's code.
 *
 * Admin (/admin/:path*): a real 307 to /admin/login?next=... for a signed-out
 * page request, instead of a 200 shell that only redirects in the browser.
 * "Signed out" means NO Better Auth session cookie at all (getSessionCookie
 * also reads the __Secure- prefixed name used in production). There is no
 * database call and no session validation here: presence only. A forged or
 * expired cookie value passes this check and is rejected by the server-side
 * requireRole()/getAdminAccess() checks in every admin page, action and route,
 * which remain the sole authority. Prefetches and non-GET/HEAD requests (Server
 * Action POSTs) are never redirected; the action's own check answers them.
 *
 * Product (/aroma-chemicals/:slug): real 404 status for unknown, draft and
 * archived slugs. With Cache Components and Partial Prefetching, the product
 * page is served as an App Shell (layouts) that streams before the page
 * renders, so a notFound() in the page could only produce a 200 with noindex.
 * Checking the slug here, before rendering, lets an unpublished slug be
 * rewritten to an unmatched path, which Next.js answers with the root
 * not-found page and a 404. The page keeps its own notFound() as a second line
 * of defence. The query module (Prisma) is loaded only in this branch.
 *
 * Segment applications (/fragrances/:application, /flavours/:application): the
 * same problem and the same fix, with a pure check against the fixed slug lists
 * (no database). An unknown slug is rewritten to the same unmatched path.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isAdminPath(pathname)) {
    const target = adminRedirectTarget({
      pathname,
      search,
      method: request.method,
      hasSessionCookie: getSessionCookie(request) !== null,
      isPrefetch: isPrefetchRequest(request.headers),
    });
    // The target is always a relative /admin/login path: resolved against
    // the request URL it can only stay on this origin.
    return target ? NextResponse.redirect(new URL(target, request.url), 307) : NextResponse.next();
  }

  if (isUnknownApplicationPath(pathname)) {
    return NextResponse.rewrite(new URL("/_catalogue/not-found", request.url));
  }

  if (!pathname.startsWith(PRODUCT_PREFIX)) return NextResponse.next();

  const raw = pathname.split("/")[2] ?? "";
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    slug = "";
  }
  const { isPublishedSlug } = await import("@/features/products/queries");
  if (slug && (await isPublishedSlug(slug))) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_catalogue/not-found", request.url));
}

// Router prefetches skip the proxy entirely, on both branches. Next.js strips
// these headers from request.headers inside the proxy (proxy.md, "RSC requests
// and rewrites"), so they can only be excluded here, in the matcher. The
// matcher must be literal constants (it is analysed at build time), hence the
// repetition.
export const config = {
  matcher: [
    {
      // One segment below the catalogue: product pages only (documents/[id] is
      // two segments). A prefetch only fetches the generic App Shell, so it
      // needs no lookup; the real navigation still gets the 404 check.
      source: "/aroma-chemicals/:slug",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
      ],
    },
    {
      // Fragrance and flavour application pages: a slug check only (no database), so
      // unknown slugs answer a real 404. Prefetches skip it like the other branches.
      source: "/:segment(fragrances|flavours)/:application",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
      ],
    },
    {
      // Every admin page; /admin/login is let through in code. /api/admin/* is
      // not matched: its route handler answers 401/403 itself.
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
      ],
    },
  ],
};
