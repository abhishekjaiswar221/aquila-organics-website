import type { Metadata } from "next";
import { ContentPage } from "@/components/pages/content-page";
import { JsonLd } from "@/components/pages/json-ld";
import { aboutBlocks, aboutMeta } from "@/content/about";
import { buildPageMetadata, organizationJsonLd, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

const PATH = "/about";

export const metadata: Metadata = buildPageMetadata({
  title: aboutMeta.title,
  description: aboutMeta.description,
  path: PATH,
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationJsonLd(SITE_URL)} />
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: aboutMeta.title, path: PATH },
          ],
          SITE_URL,
        )}
      />
      <ContentPage title={aboutMeta.title} lead={aboutMeta.lead} path={PATH} eyebrow="Company" blocks={aboutBlocks} />
    </>
  );
}
