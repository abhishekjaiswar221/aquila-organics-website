import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Small, dense building blocks for the admin: same tokens as the public site,
// none of its marketing treatment.

export const inputCls =
  "h-10 w-full min-w-0 border border-charcoal/40 bg-white px-3 text-sm text-charcoal placeholder:text-muted-foreground focus-visible:border-charcoal";
export const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground";
export const buttonCls =
  "inline-flex min-h-10 items-center justify-center gap-1.5 border border-charcoal bg-charcoal px-4 text-sm font-medium text-ivory hover:bg-charcoal/85 disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButtonCls =
  "inline-flex min-h-9 items-center justify-center border border-charcoal/50 bg-white px-3 text-sm text-charcoal hover:border-charcoal hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60";
export const linkCls = "text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2";

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-charcoal/20 pb-4">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-sans text-sm font-semibold uppercase tracking-[0.1em] text-charcoal">
      {children}
    </h2>
  );
}

const BADGE: Record<string, string> = {
  PUBLISHED: "border-olive-deep bg-olive-deep text-white",
  DRAFT: "border-charcoal/40 bg-cream text-charcoal",
  ARCHIVED: "border-charcoal/30 bg-white text-muted-foreground",
  NEW: "border-bronze-text bg-white text-bronze-text",
  WON: "border-olive-deep bg-olive-deep text-white",
  LOST: "border-charcoal/30 bg-white text-muted-foreground",
};

export function Badge({ value, children }: { value: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em]",
        BADGE[value] ?? "border-charcoal/40 bg-white text-charcoal",
      )}
    >
      {children}
    </span>
  );
}

/** A table that scrolls inside its own focusable region on narrow screens. */
export function TableScroller({ label, children }: { label: string; children: ReactNode }) {
  return (
    // tabIndex: a scrollable region must be keyboard-reachable (axe scrollable-region-focusable).
    // relative: sr-only (absolute) labels inside the table must be clipped here, not widen the page.
    <div role="region" aria-label={label} tabIndex={0} className="relative mt-4 overflow-x-auto border border-charcoal/20 bg-white">
      {children}
    </div>
  );
}

export const thCls =
  "whitespace-nowrap border-b border-charcoal/20 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
export const tdCls = "border-b border-charcoal/10 px-3 py-2.5 align-top";

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const current = Math.min(page, pageCount);
  const cell = "inline-flex min-h-10 min-w-10 items-center justify-center border border-charcoal/30 bg-white px-3 text-sm";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      {current > 1 ? (
        <Link href={hrefFor(current - 1)} rel="prev" className={cn(cell, "hover:border-charcoal")}>
          Previous
        </Link>
      ) : null}
      <span className="px-2 text-muted-foreground">
        Page {current} of {pageCount}
      </span>
      {current < pageCount ? (
        <Link href={hrefFor(current + 1)} rel="next" className={cn(cell, "hover:border-charcoal")}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Server-rendered, timezone-stable timestamp. */
export function Timestamp({ value }: { value: Date }) {
  return <time dateTime={value.toISOString()}>{`${dateFormat.format(value)} UTC`}</time>;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
