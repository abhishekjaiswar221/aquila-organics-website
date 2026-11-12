import type { MetadataRoute } from "next";
import { robotsConfig } from "@/lib/seo/sitemap";
import { SITE_URL } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return robotsConfig(SITE_URL, { noindex: process.env.DEMO_NOINDEX === "1" });
}
