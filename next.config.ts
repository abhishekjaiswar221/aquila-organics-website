import type { NextConfig } from "next";
// Relative import: Next loads this file itself, so the "@/" alias is not available here.
import { redirectRules } from "./src/content/redirects";

const nextConfig: NextConfig = {
  // Old-site URLs for pages that now exist: one 301 each (src/content/redirects.ts). An explicit
  // statusCode is used instead of `permanent`, which would answer 308.
  async redirects() {
    return redirectRules.map((r) => ({ source: r.source, destination: r.destination, statusCode: 301 }));
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Enables forbidden()/unauthorized(); requireRole() uses forbidden() for 403s.
    authInterrupts: true,
    serverActions: {
      // RFQ: up to 5 attachments of 10 MB each, plus form fields and multipart overhead.
      bodySizeLimit: "52mb",
    },
  },
  // Defence in depth for the admin (pages also send robots noindex metadata;
  // robots.txt disallows /admin and /api; the sitemap never lists them).
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    // A demo deployment (DEMO_NOINDEX=1) is kept out of search results entirely.
    if (process.env.DEMO_NOINDEX === "1") return [{ source: "/:path*", headers: noindex }];
    return [
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/api/admin/:path*", headers: noindex },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
