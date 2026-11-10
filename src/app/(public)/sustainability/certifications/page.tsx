import type { Metadata } from "next";
import { connection } from "next/server";
import { CertificationsPage } from "@/components/pages/certifications-page";
import { JsonLd } from "@/components/pages/json-ld";
import { certificates, certificationsMeta, certificationsPending } from "@/content/certifications";
import { hasConfirmedCertificates } from "@/lib/certificates";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

/*
 * Cache Components: the page compares expiry dates with the current time, so it is rendered per
 * request (connection() before new Date(), which cannot run during prerender). The robots meta and
 * the sitemap use hasConfirmedCertificates() instead, which needs no clock: the page is noindex
 * until at least one confirmed certificate exists.
 */
export const instant = false;

const PATH = "/sustainability/certifications";

export const metadata: Metadata = buildPageMetadata({
  title: certificationsMeta.title,
  description: certificationsMeta.description,
  path: PATH,
  noindex: !hasConfirmedCertificates(certificates),
});

export default async function CertificationsRoute() {
  await connection();
  const now = new Date();
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: "Sustainability", path: "/sustainability" },
            { name: certificationsMeta.title, path: PATH },
          ],
          SITE_URL,
        )}
      />
      <CertificationsPage certificates={certificates} now={now} pending={certificationsPending.data} />
    </>
  );
}
