import type { Metadata } from "next";
import { ContentPage } from "@/components/pages/content-page";
import { JsonLd } from "@/components/pages/json-ld";
import { innovationBlocks, innovationMeta } from "@/content/innovation";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

const PATH = "/innovation";

export const metadata: Metadata = buildPageMetadata({
  title: innovationMeta.title,
  description: innovationMeta.description,
  path: PATH,
});

export default function InnovationPage() {
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: innovationMeta.title, path: PATH },
          ],
          SITE_URL,
        )}
      />
      <ContentPage
        title={innovationMeta.title}
        lead={innovationMeta.lead}
        path={PATH}
        eyebrow="Aroma chemicals"
        blocks={innovationBlocks}
      />
    </>
  );
}
