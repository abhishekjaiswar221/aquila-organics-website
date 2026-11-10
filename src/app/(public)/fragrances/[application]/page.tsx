import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationPage } from "@/components/pages/application-page";
import { JsonLd } from "@/components/pages/json-ld";
import { APPLICATION_SLUGS, findApplication, fragranceSegment } from "@/content/segments";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

// Only the six known applications are prerendered. Anything else reaches notFound() below, and
// src/proxy.ts answers it with a real 404 status before rendering (see the proxy header comment).
export function generateStaticParams() {
  return APPLICATION_SLUGS.fragrances.map((application) => ({ application }));
}

export async function generateMetadata({ params }: PageProps<"/fragrances/[application]">): Promise<Metadata> {
  const record = findApplication("fragrances", (await params).application);
  if (!record) return { title: "Page not found", robots: { index: false, follow: true } };
  return buildPageMetadata({
    title: `${record.name} fragrances`,
    description: record.summary,
    path: `${fragranceSegment.path}/${record.slug}`,
  });
}

export default async function FragranceApplicationPage({ params }: PageProps<"/fragrances/[application]">) {
  const record = findApplication("fragrances", (await params).application);
  if (!record) notFound();
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: fragranceSegment.name, path: fragranceSegment.path },
            { name: record.name, path: `${fragranceSegment.path}/${record.slug}` },
          ],
          SITE_URL,
        )}
      />
      <ApplicationPage segment={fragranceSegment} application={record} />
    </>
  );
}
