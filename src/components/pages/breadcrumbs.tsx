import Link from "next/link";
import type { Crumb } from "@/lib/seo/page-metadata";

/** Visible breadcrumb trail; the last crumb is the current page and is not a link. */
export function Breadcrumbs({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((crumb, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-charcoal">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.path} className="underline underline-offset-4">
                    {crumb.name}
                  </Link>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
