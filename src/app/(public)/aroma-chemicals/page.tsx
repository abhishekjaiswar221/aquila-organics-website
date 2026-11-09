import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueEmptyState } from "@/components/catalogue/empty-state";
import { Pagination } from "@/components/catalogue/pagination";
import { ProductCard, ROW_GRID } from "@/components/catalogue/product-card";
import { SearchForm } from "@/components/catalogue/search-form";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  CATALOGUE_DESCRIPTION,
  catalogueHref,
  catalogueListMetadata,
  catalogueView,
  parseCatalogueSearchParams,
} from "@/features/products/catalogue-params";
import { PAGE_SIZE, searchProducts } from "@/features/products/queries";
import { CATALOGUE_PATH } from "@/lib/seo/site-url";

/*
 * Cache Components: this page reads searchParams and queries the database on
 * every request, deliberately without `use cache` (a publish or unpublish must
 * show at once) and without a <Suspense> boundary: the whole response is
 * rendered before it is sent, so the GET search works without JavaScript
 * (streamed Suspense content needs a script to be revealed) and metadata such
 * as robots noindex is resolved with the page. `instant = false` declares that
 * blocking is intended and opts the route out of static-shell validation.
 */
export const instant = false;

export async function generateMetadata({ searchParams }: PageProps<"/aroma-chemicals">): Promise<Metadata> {
  return catalogueListMetadata(parseCatalogueSearchParams(await searchParams));
}

export default async function CataloguePage({ searchParams }: PageProps<"/aroma-chemicals">) {
  const state = parseCatalogueSearchParams(await searchParams);
  const result = await searchProducts({
    q: state.q || undefined,
    category: state.category || undefined,
    sort: state.sort,
    page: state.page,
  });
  const view = catalogueView(state, result);
  const from = (result.page - 1) * PAGE_SIZE + 1;
  const to = from + result.items.length - 1;

  return (
    <>
      <section aria-labelledby="catalogue-title" className="border-b border-charcoal/20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-12 pt-14 lg:grid-cols-12 lg:pb-16 lg:pt-20">
          <div className="lg:col-span-8">
            <Eyebrow>Aroma chemicals / Catalogue</Eyebrow>
            <h1 id="catalogue-title" className="text-display-lg mt-4">
              Aroma chemicals
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{CATALOGUE_DESCRIPTION}</p>
          </div>
          <p className="self-end font-mono text-xs uppercase leading-relaxed tracking-[0.16em] text-muted-foreground lg:col-span-4 lg:text-right">
            Published products only.
            <br />
            Specifications on request.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        {view === "empty-catalogue" ? (
          <CatalogueEmptyState />
        ) : (
          <>
            <SearchForm state={state} categories={result.categories} />

            <section aria-labelledby="results-title" className="mt-12">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-charcoal pb-3">
                <h2 id="results-title" className="text-2xl">
                  {state.q ? "Search results" : "All products"}
                </h2>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {result.total} {result.total === 1 ? "product" : "products"}
                  {view === "results" && result.pageCount > 1 ? ` \u{00B7} ${from}\u{2013}${to}` : null}
                </p>
              </div>

              {view === "results" ? (
                <>
                  <div
                    aria-hidden
                    className={`hidden border-b border-charcoal/20 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground ${ROW_GRID}`}
                  >
                    <span>Product</span>
                    <span>Code</span>
                    <span>CAS number</span>
                    <span>Category</span>
                    <span className="w-28" />
                  </div>
                  <ul aria-label="Products">
                    {result.items.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </ul>
                  <Pagination state={state} pageCount={result.pageCount} />
                </>
              ) : null}

              {view === "no-results" ? (
                <div className="py-12">
                  <h3 className="text-display-md">No products match your search.</h3>
                  <p className="mt-4 max-w-2xl text-muted-foreground">
                    Check the spelling or the CAS number, try a product code, or remove the category filter. If you
                    cannot find what you need, our team can still help with a quotation.
                  </p>
                  <Link
                    href={CATALOGUE_PATH}
                    className="mt-6 inline-block text-sm text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2"
                  >
                    Clear filters
                  </Link>
                </div>
              ) : null}

              {view === "page-out-of-range" ? (
                <div className="py-12">
                  <h3 className="text-display-md">This page is past the end of the results.</h3>
                  <Link
                    href={catalogueHref(state, { page: 1 })}
                    className="mt-6 inline-block text-sm text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2"
                  >
                    Go to the first page
                  </Link>
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </>
  );
}
