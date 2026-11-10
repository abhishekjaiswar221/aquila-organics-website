import type { Metadata } from "next";
import { ContentPage } from "@/components/pages/content-page";
import { JsonLd } from "@/components/pages/json-ld";
import { sustainabilityBlocks, sustainabilityMeta } from "@/content/sustainability";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

const PATH = "/sustainability";

export const metadata: Metadata = buildPageMetadata({
  title: sustainabilityMeta.title,
  description: sustainabilityMeta.description,
  path: PATH,
});

export default function SustainabilityPage() {
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: sustainabilityMeta.title, path: PATH },
          ],
          SITE_URL,
        )}
      />
      <ContentPage
        title={sustainabilityMeta.title}
        lead={sustainabilityMeta.lead}
        path={PATH}
        eyebrow="Responsibility"
        blocks={sustainabilityBlocks}
      />
    </>
  );
}
