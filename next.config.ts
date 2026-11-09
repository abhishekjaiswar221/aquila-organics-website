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
