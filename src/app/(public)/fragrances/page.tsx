import type { Metadata } from "next";
import { JsonLd } from "@/components/pages/json-ld";
import { SegmentPage } from "@/components/pages/segment-page";
import { fragranceSegment } from "@/content/segments";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

export const metadata: Metadata = buildPageMetadata({
  title: "Fragrances",
  description:
    "Fragrances from Aquila Organics for fine fragrance, personal care, air care, fabric care, home care, and incense and bakhoor.",
  path: fragranceSegment.path,
});

export default function FragrancesPage() {
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: fragranceSegment.name, path: fragranceSegment.path },
          ],
          SITE_URL,
        )}
      />
      <SegmentPage segment={fragranceSegment} />
    </>
  );
}
