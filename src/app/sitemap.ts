import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { certificates } from "@/content/certifications";
import { listPublishedJobs } from "@/features/careers/job-queries";
import { getPublishedSitemapEntries } from "@/features/products/queries";
import { hasConfirmedCertificates } from "@/lib/certificates";
import { buildSitemap } from "@/lib/seo/sitemap";
import { SITE_URL } from "@/lib/seo/site-url";

// Built per request (connection()), never at build time: publishing or
// unpublishing a product changes the sitemap at once, and the build does not
// need database access.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const jobs = (await listPublishedJobs(new Date())).map((j) => ({ slug: j.slug, lastModified: j.updatedAt }));
  return buildSitemap(SITE_URL, await getPublishedSitemapEntries(), {
    certificationsIndexable: hasConfirmedCertificates(certificates),
    jobs,
  });
}
