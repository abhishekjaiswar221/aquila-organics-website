import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH, safeAdminNext } from "./login";

// Pure decision for the admin branch of src/proxy.ts. No database, no session
// validation: it only looks at whether a session cookie is present at all.

export type AdminRedirectInput = {
  pathname: string;
  /** The URL's search string, including its leading "?" (or ""). */
  search: string;
  method: string;
  hasSessionCookie: boolean;
  isPrefetch: boolean;
};

const PAGE_METHODS = new Set(["GET", "HEAD"]);

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isLoginPath(pathname: string): boolean {
  return pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`);
}

/** Router (Next.js) and browser (speculation rules, link rel=prefetch) prefetch headers. */
export function isPrefetchRequest(headers: Headers): boolean {
  if (headers.has("next-router-prefetch") || headers.has("next-router-segment-prefetch")) return true;
  if (headers.get("purpose")?.toLowerCase() === "prefetch") return true;
  return headers.get("sec-purpose")?.toLowerCase().includes("prefetch") ?? false;
}

/**
 * Where to send a request for an admin page, or null to let it through.
 *
 * Only a signed-out (no session cookie at all) GET/HEAD page request is
 * redirected, to the login page with the requested page as `next`. Prefetches
 * and Server Action POSTs pass, as does the login page itself. The `next`
 * value goes through safeAdminNext, so it is always a relative /admin path.
 * Bare /admin uses the products list (where /admin itself redirects anyway).
 */
export function adminRedirectTarget(input: AdminRedirectInput): string | null {
  if (!PAGE_METHODS.has(input.method.toUpperCase())) return null;
  if (input.isPrefetch || input.hasSessionCookie) return null;
  if (!isAdminPath(input.pathname) || isLoginPath(input.pathname)) return null;
  const next =
    input.pathname === "/admin" || input.pathname === "/admin/"
      ? ADMIN_HOME_PATH
      : safeAdminNext(input.pathname + input.search);
  return `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
