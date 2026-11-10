import type { Metadata } from "next";
import { JsonLd } from "@/components/pages/json-ld";
import { SegmentPage } from "@/components/pages/segment-page";
import { flavourSegment } from "@/content/segments";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

export const metadata: Metadata = buildPageMetadata({
  title: "Flavours",
  description:
    "Flavours from Aquila Organics for confectionery, bakery, beverages, dairy and savoury foods.",
  path: flavourSegment.path,
});

export default function FlavoursPage() {
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: flavourSegment.name, path: flavourSegment.path },
          ],
          SITE_URL,
        )}
      />
      <SegmentPage segment={flavourSegment} />
    </>
  );
}
