import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
