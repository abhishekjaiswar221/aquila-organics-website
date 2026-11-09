import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AddToEnquiryButton } from "@/components/catalogue/add-to-enquiry-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { contacts } from "@/content/site";
import { getPublishedProduct, getRelatedProducts, type ProductDetail } from "@/features/products/queries";
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd } from "@/lib/seo/product-jsonld";
import { productMetadata } from "@/lib/seo/product-metadata";
import { CATALOGUE_PATH, SITE_URL, productPath } from "@/lib/seo/site-url";

/*
 * Cache Components: rendered per request with no `use cache` (a status change
 * must apply at once). The product content is awaited outside <Suspense>, so it
 * arrives complete in the HTML (no script needed to reveal it); only the layout
 * App Shell is prerendered. `instant = false` declares that blocking is intended.
 * Unpublished slugs get their 404 status from src/proxy.ts before rendering;
 * the notFound() below is the in-render fallback (200 + noindex if reached).
 */
export const instant = false;

// One query per request, shared by generateMetadata and the page.
const loadProduct = cache((slug: string) => getPublishedProduct(slug));

export async function generateMetadata({ params }: PageProps<"/aroma-chemicals/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  if (!product) return { title: "Product not found", robots: { index: false, follow: true } };
  return productMetadata(product);
}

const DOCUMENT_KIND: Record<ProductDetail["documents"][number]["kind"], string> = {
  DATASHEET: "Datasheet",
  SDS: "Safety data sheet",
  OTHER: "Document",
};

function quoteMailto(p: ProductDetail): string {
  const subject = `Quotation request: ${p.name}${p.casNumber ? ` (CAS ${p.casNumber})` : ""}`;
  return `mailto:${contacts.sales}?subject=${encodeURIComponent(subject)}`;
}

const sectionTitle = "text-display-md";
const rule = "border-t border-charcoal pt-8";

export default async function ProductPage({ params }: PageProps<"/aroma-chemicals/[slug]">) {
  const product = await loadProduct((await params).slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product.id, 4);

  const identifiers = [
    { label: "Product code", value: product.code },
    { label: "CAS number", value: product.casNumber },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd(product, SITE_URL)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(product, SITE_URL)) }}
      />

      <div className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-10 lg:pb-16 lg:pt-14">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-charcoal hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={CATALOGUE_PATH} className="hover:text-charcoal hover:underline">
                  Aroma chemicals
                </Link>
              </li>
              {product.category ? (
                <>
                  <li aria-hidden>/</li>
                  <li>
                    <Link
                      href={`${CATALOGUE_PATH}?category=${encodeURIComponent(product.category.slug)}`}
                      className="hover:text-charcoal hover:underline"
                    >
                      {product.category.name}
                    </Link>
                  </li>
                </>
              ) : null}
              <li aria-hidden>/</li>
              <li>
                <span aria-current="page" className="text-charcoal">
                  {product.name}
                </span>
              </li>
            </ol>
          </nav>

          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="min-w-0 lg:col-span-8">
              <Eyebrow>{product.category ? product.category.name : "Aroma chemical"}</Eyebrow>
              <h1 className="text-display-lg mt-4">{product.name}</h1>
              {identifiers.length > 0 ? (
                <dl className="mt-10 grid border-l border-t border-charcoal/30 sm:grid-cols-2">
                  {identifiers.map((f) => (
                    <div key={f.label} className="border-b border-r border-charcoal/30 bg-white p-5">
                      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-bronze-text">{f.label}</dt>
                      <dd className="mt-2 font-mono text-lg">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            <aside aria-label="Enquire" className="self-start border border-charcoal bg-white p-6 lg:col-span-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Enquire</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Add this product to your enquiry list to request quotations for several products at once, or email
                our sales team directly.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <AddToEnquiryButton productId={product.id} productName={product.name} />
                <a
                  href={quoteMailto(product)}
                  className="inline-flex items-center justify-center rounded-sm border border-charcoal px-7 py-3.5 text-sm font-medium tracking-wide transition-colors hover:bg-charcoal hover:text-ivory"
                >
                  Request a quote
                </a>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-16 px-6 py-14 lg:py-20">
        {product.description ? (
          <section aria-labelledby="description-title" className={`${rule} grid gap-6 lg:grid-cols-12`}>
            <h2 id="description-title" className={`${sectionTitle} lg:col-span-4`}>
              Description
            </h2>
            <p className="max-w-[65ch] whitespace-pre-line leading-relaxed lg:col-span-8">{product.description}</p>
          </section>
        ) : null}

        {product.specifications.length > 0 ? (
          <section aria-labelledby="specifications-title" className={`${rule} grid gap-6 lg:grid-cols-12`}>
            <h2 id="specifications-title" className={`${sectionTitle} lg:col-span-4`}>
              Specifications
            </h2>
            <div className="min-w-0 lg:col-span-8">
              <table aria-labelledby="specifications-title" className="w-full border-collapse text-left">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Property</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {product.specifications.map((s) => (
                    <tr key={s.id} className="border-b border-charcoal/20 align-top">
                      <th
                        scope="row"
                        className="w-2/5 py-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        {s.label}
                      </th>
                      <td className="py-3 font-mono text-sm">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {product.applications.length > 0 ? (
          <section aria-labelledby="applications-title" className={`${rule} grid gap-6 lg:grid-cols-12`}>
            <h2 id="applications-title" className={`${sectionTitle} lg:col-span-4`}>
              Applications
            </h2>
            <ul className="grid border-l border-t border-charcoal/30 sm:grid-cols-2 lg:col-span-8">
              {product.applications.map((a) => (
                <li key={a.id} className="border-b border-r border-charcoal/30 p-4 text-sm">
                  {a.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {product.documents.length > 0 ? (
          <section aria-labelledby="documents-title" className={`${rule} grid gap-6 lg:grid-cols-12`}>
            <h2 id="documents-title" className={`${sectionTitle} lg:col-span-4`}>
              Documents
            </h2>
            <ul className="lg:col-span-8">
              {product.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-charcoal/20 py-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {DOCUMENT_KIND[d.kind]}
                  </span>
                  {/* A file download from a route handler, so a plain anchor rather than next/link. */}
                  <a
                    href={`${CATALOGUE_PATH}/documents/${d.id}`}
                    className="min-w-0 text-sm underline underline-offset-4 decoration-1 hover:decoration-2"
                  >
                    {d.title}
                    <span className="sr-only"> (download)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section aria-labelledby="related-title" className={rule}>
            <h2 id="related-title" className={sectionTitle}>
              Related products
            </h2>
            <ul className="mt-8 grid border-l border-t border-charcoal/30 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <li key={r.id} className="border-b border-r border-charcoal/30 bg-white">
                  <Link href={productPath(r.slug)} className="block h-full p-5 hover:bg-cream">
                    <span className="block font-medium">{r.name}</span>
                    {r.code ? <span className="mt-2 block font-mono text-xs text-muted-foreground">{r.code}</span> : null}
                    {r.casNumber ? (
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">CAS {r.casNumber}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
