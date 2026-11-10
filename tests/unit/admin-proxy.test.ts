import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminRedirectTarget, isPrefetchRequest } from "@/features/admin/proxy-redirect";

type Input = Parameters<typeof adminRedirectTarget>[0];

const signedOut = (pathname: string, extra: Partial<Input> = {}): Input => ({
  pathname,
  search: "",
  method: "GET",
  hasSessionCookie: false,
  isPrefetch: false,
  ...extra,
});

/** The decoded `next` of a target, asserting the target itself is the local login page. */
function nextOf(target: string | null): string {
  expect(target).not.toBeNull();
  const url = new URL(target ?? "", "https://site.invalid");
  expect(url.origin).toBe("https://site.invalid");
  expect(target?.startsWith("/admin/login?next=")).toBe(true);
  expect(url.pathname).toBe("/admin/login");
  return url.searchParams.get("next") ?? "";
}

describe("adminRedirectTarget", () => {
  it("sends a signed-out request for an admin page to the login page with next", () => {
    expect(adminRedirectTarget(signedOut("/admin/products"))).toBe("/admin/login?next=%2Fadmin%2Fproducts");
    expect(adminRedirectTarget(signedOut("/admin/enquiries"))).toBe("/admin/login?next=%2Fadmin%2Fenquiries");
    expect(adminRedirectTarget(signedOut("/admin/enquiries/00000000-0000-4000-8000-000000000001"))).toBe(
      "/admin/login?next=%2Fadmin%2Fenquiries%2F00000000-0000-4000-8000-000000000001",
    );
  });

  it("keeps and encodes the query string", () => {
    const target = adminRedirectTarget(signedOut("/admin/enquiries", { search: "?status=NEW&q=a%20b" }));
    expect(target).toBe("/admin/login?next=%2Fadmin%2Fenquiries%3Fstatus%3DNEW%26q%3Da%2520b");
    expect(nextOf(target)).toBe("/admin/enquiries?status=NEW&q=a%20b");
  });

  it("bare /admin goes to login with the products list as next", () => {
    expect(adminRedirectTarget(signedOut("/admin"))).toBe("/admin/login?next=%2Fadmin%2Fproducts");
    expect(adminRedirectTarget(signedOut("/admin/"))).toBe("/admin/login?next=%2Fadmin%2Fproducts");
    expect(adminRedirectTarget(signedOut("/admin", { search: "?x=1" }))).toBe("/admin/login?next=%2Fadmin%2Fproducts");
  });

  it("lets any request with a session cookie through (the server decides)", () => {
    expect(adminRedirectTarget(signedOut("/admin/products", { hasSessionCookie: true }))).toBeNull();
    expect(adminRedirectTarget(signedOut("/admin", { hasSessionCookie: true }))).toBeNull();
  });

  it("never redirects the login page itself", () => {
    expect(adminRedirectTarget(signedOut("/admin/login"))).toBeNull();
    expect(adminRedirectTarget(signedOut("/admin/login", { search: "?next=%2Fadmin%2Fenquiries" }))).toBeNull();
    expect(adminRedirectTarget(signedOut("/admin/login/x"))).toBeNull();
    // Only the login segment itself is exempt.
    expect(adminRedirectTarget(signedOut("/admin/loginx"))).toBe("/admin/login?next=%2Fadmin%2Floginx");
  });

  it("leaves Server Action POSTs and other non-GET/HEAD methods to the server-side check", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      expect(adminRedirectTarget(signedOut("/admin/products", { method }))).toBeNull();
    }
    expect(adminRedirectTarget(signedOut("/admin/products", { method: "HEAD" }))).toBe(
      "/admin/login?next=%2Fadmin%2Fproducts",
    );
    expect(adminRedirectTarget(signedOut("/admin/products", { method: "get" }))).toBe(
      "/admin/login?next=%2Fadmin%2Fproducts",
    );
  });

  it("leaves prefetches alone", () => {
    expect(adminRedirectTarget(signedOut("/admin/products", { isPrefetch: true }))).toBeNull();
  });

  it("ignores paths outside the admin", () => {
    for (const path of ["/", "/aroma-chemicals/x", "/administrator", "/api/admin/attachments/x", "//evil.com"]) {
      expect(adminRedirectTarget(signedOut(path))).toBeNull();
    }
  });

  it("never produces an external or non-admin next, whatever the path", () => {
    const hostile = [
      "/admin/../x",
      "/admin/..%2f..%2fevil",
      "/admin/%2e%2e/x",
      "/admin/\\evil.com",
      "/admin/\t/evil.com",
      "/admin//evil.com",
      "/admin/x?y=//evil.com",
      `/admin/${"a".repeat(600)}`,
    ];
    for (const path of hostile) {
      const [pathname, query] = path.split("?");
      const target = adminRedirectTarget(signedOut(pathname, { search: query ? `?${query}` : "" }));
      const next = nextOf(target);
      expect(next.startsWith("/admin")).toBe(true);
      expect(next.startsWith("//")).toBe(false);
      expect(new URL(next, "https://site.invalid").origin).toBe("https://site.invalid");
    }
    expect(nextOf(adminRedirectTarget(signedOut("/admin/../x")))).toBe("/admin/products");
    expect(nextOf(adminRedirectTarget(signedOut(`/admin/${"a".repeat(600)}`)))).toBe("/admin/products");
  });
});

describe("Better Auth getSessionCookie (what the proxy uses for presence)", () => {
  it("finds the plain and the production __Secure- prefixed session cookie, and nothing else", async () => {
    const { getSessionCookie } = await import("better-auth/cookies");
    const req = (cookie?: string) => new Request("https://site.invalid/admin", { headers: cookie ? { cookie } : {} });
    expect(getSessionCookie(req("better-auth.session_token=abc"))).toBe("abc");
    expect(getSessionCookie(req("__Secure-better-auth.session_token=def"))).toBe("def");
    expect(getSessionCookie(req("other=1; better-auth.session_data=x"))).toBeNull();
    expect(getSessionCookie(req())).toBeNull();
  });
});

describe("isPrefetchRequest", () => {
  it("recognises router and browser prefetch headers", () => {
    expect(isPrefetchRequest(new Headers({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "next-router-segment-prefetch": "/_tree" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ accept: "text/html" }))).toBe(false);
  });
});

describe("proxy matcher", () => {
  // Next.js strips next-router-prefetch (and the other Flight headers) from
  // request.headers inside the proxy, so router prefetches can only be skipped
  // in the matcher. Both branches skip them the same way.
  it("skips router prefetches for product, segment-application and admin paths alike, in the matcher", async () => {
    const { config } = await import("@/proxy");
    const entries = config.matcher.map((m) => (typeof m === "string" ? { source: m, missing: [] } : m));
    expect(entries.map((e) => e.source)).toEqual([
      "/aroma-chemicals/:slug",
      "/:segment(fragrances|flavours)/:application",
      "/admin/:path*",
    ]);
    for (const entry of entries) {
      expect(entry.missing, entry.source).toEqual([
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
      ]);
    }
  });

  it("has no in-code next-router-prefetch check (it could never be true)", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/proxy.ts"), "utf8");
    expect(source).not.toMatch(/headers\.has\(["']next-router-prefetch["']\)/);
  });
});
