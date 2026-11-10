import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationPage } from "@/components/pages/application-page";
import { JsonLd } from "@/components/pages/json-ld";
import { APPLICATION_SLUGS, findApplication, flavourSegment } from "@/content/segments";
import { buildPageMetadata, pageBreadcrumbJsonLd } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

// Only the five known applications are prerendered. Anything else reaches notFound() below, and
// src/proxy.ts answers it with a real 404 status before rendering (see the proxy header comment).
export function generateStaticParams() {
  return APPLICATION_SLUGS.flavours.map((application) => ({ application }));
}

export async function generateMetadata({ params }: PageProps<"/flavours/[application]">): Promise<Metadata> {
  const record = findApplication("flavours", (await params).application);
  if (!record) return { title: "Page not found", robots: { index: false, follow: true } };
  return buildPageMetadata({
    title: `${record.name} flavours`,
    description: record.summary,
    path: `${flavourSegment.path}/${record.slug}`,
  });
}

export default async function FlavourApplicationPage({ params }: PageProps<"/flavours/[application]">) {
  const record = findApplication("flavours", (await params).application);
  if (!record) notFound();
  return (
    <>
      <JsonLd
        data={pageBreadcrumbJsonLd(
          [
            { name: "Home", path: "/" },
            { name: flavourSegment.name, path: flavourSegment.path },
            { name: record.name, path: `${flavourSegment.path}/${record.slug}` },
          ],
          SITE_URL,
        )}
      />
      <ApplicationPage segment={flavourSegment} application={record} />
    </>
  );
}
