import { serializeJsonLd } from "@/lib/seo/product-jsonld";

/** Embeds structured data using the shared serializer, which escapes `<`, `>`, `&` and line separators. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
