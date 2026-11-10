import type { Metadata } from "next";
import { ContentPage } from "@/components/pages/content-page";
import { JsonLd } from "@/components/pages/json-ld";
import { complianceBlocks, complianceMeta, sustainabilityMeta } from "@/content/sustainability";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

const PATH = "/sustainability/compliance";
const TRAIL = [
  { name: "Home", path: "/" },
  { name: sustainabilityMeta.title, path: "/sustainability" },
  { name: complianceMeta.title, path: PATH },
];

export const metadata: Metadata = buildPageMetadata({
  title: complianceMeta.title,
  description: complianceMeta.description,
  path: PATH,
});

export default function CompliancePage() {
  return (
    <>
      <JsonLd data={pageBreadcrumbJsonLd(TRAIL, SITE_URL)} />
      <ContentPage
        title={complianceMeta.title}
        lead={complianceMeta.lead}
        path={PATH}
        eyebrow="Responsibility"
        blocks={complianceBlocks}
        trail={TRAIL}
      />
    </>
  );
}
