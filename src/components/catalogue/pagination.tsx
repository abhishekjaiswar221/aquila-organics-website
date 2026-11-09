import Link from "next/link";
import { catalogueHref, type CatalogueState } from "@/features/products/catalogue-params";
import { cn } from "@/lib/utils";

/** Page numbers to show: first, last, and a window around the current page. */
function pageWindow(current: number, count: number): (number | "gap")[] {
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev > 1) out.push("gap");
    out.push(p);
  }
  return out;
}

const cell = "inline-flex min-h-11 min-w-11 items-center justify-center border border-charcoal/30 px-3 font-mono text-sm";

export function Pagination({ state, pageCount }: { state: CatalogueState; pageCount: number }) {
  if (pageCount <= 1) return null;
  const current = Math.min(state.page, pageCount);
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center gap-2">
      {current > 1 ? (
        <Link href={catalogueHref(state, { page: current - 1 })} rel="prev" className={cn(cell, "hover:bg-charcoal hover:text-ivory")}>
          <span aria-hidden>&larr;</span>
          <span className="sr-only">Previous page</span>
        </Link>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {pageWindow(current, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className={cn(cell, "border-transparent text-muted-foreground")}>
              &hellip;
            </li>
          ) : (
            <li key={p}>
              <Link
                href={catalogueHref(state, { page: p })}
                aria-label={`Page ${p}`}
                aria-current={p === current ? "page" : undefined}
                className={cn(cell, p === current ? "border-charcoal bg-charcoal text-ivory" : "hover:border-charcoal")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      {current < pageCount ? (
        <Link href={catalogueHref(state, { page: current + 1 })} rel="next" className={cn(cell, "hover:bg-charcoal hover:text-ivory")}>
          <span aria-hidden>&rarr;</span>
          <span className="sr-only">Next page</span>
        </Link>
      ) : null}
    </nav>
  );
}
