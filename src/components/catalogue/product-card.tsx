import Link from "next/link";
import type { ProductListItem } from "@/features/products/queries";
import { productPath } from "@/lib/seo/site-url";
import { AddToEnquiryButton } from "./add-to-enquiry-button";

/**
 * One catalogue row. Stacked with visible labels on small screens; on md+ the
 * labels become screen-reader-only and the list's column header row takes over.
 */
export const ROW_GRID = "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center md:gap-6";

export function ProductCard({ product }: { product: ProductListItem }) {
  const fields: { label: string; value: string | null; mono: boolean }[] = [
    { label: "Code", value: product.code, mono: true },
    { label: "CAS number", value: product.casNumber, mono: true },
    { label: "Category", value: product.categoryName, mono: false },
  ];
  return (
    <li className={`border-b border-charcoal/20 px-0 py-5 md:px-4 md:py-4 ${ROW_GRID}`}>
      <Link
        href={productPath(product.slug)}
        className="text-lg font-medium leading-snug underline-offset-4 decoration-1 hover:text-bronze-text hover:underline"
      >
        {product.name}
      </Link>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm md:contents">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:sr-only">
              {f.label}
            </dt>
            <dd className={f.mono ? "font-mono text-sm" : "text-sm"}>
              {f.value ?? (
                <>
                  <span aria-hidden className="text-muted-foreground">
                    &ndash;
                  </span>
                  <span className="sr-only">Not listed</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 md:mt-0 md:justify-self-end">
        <AddToEnquiryButton productId={product.id} productName={product.name} variant="compact" />
      </div>
    </li>
  );
}
