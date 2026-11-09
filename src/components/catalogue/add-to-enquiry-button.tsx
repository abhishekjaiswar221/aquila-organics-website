"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RFQ_PATH } from "@/features/enquiries/confirmation";
import { MAX_LIST_ITEMS, addProduct, useEnquiryList } from "@/features/enquiries/store-client";
import { cn } from "@/lib/utils";

interface Props {
  productId: string;
  productName: string;
  /** "primary" on the product page, "compact" in list rows. */
  variant?: "primary" | "compact";
  className?: string;
}

const viewLinkCls = "text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2";

/**
 * Adds the product id to the browser-side enquiry list (Task 9 store). Server
 * HTML always shows the button; after hydration it reflects the stored list.
 * Once added (or when the list is full) it shows a status and a link to /rfq.
 */
export function AddToEnquiryButton({ productId, productName, variant = "primary", className }: Props) {
  const list = useEnquiryList();
  const added = list.includes(productId.toLowerCase());
  const full = !added && list.length >= MAX_LIST_ITEMS;
  const [justAdded, setJustAdded] = useState(false);
  const confirmation = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // The button unmounts on click; keep keyboard focus on its replacement.
    if (justAdded) confirmation.current?.focus();
  }, [justAdded]);

  const sr = variant === "compact" ? <span className="sr-only">: {productName}</span> : null;
  const textCls = variant === "primary" ? "py-3.5 text-sm font-medium" : "font-mono text-xs";

  if (added || full) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1",
          variant === "compact" && "md:flex-col md:items-end md:gap-y-0.5",
          className,
        )}
      >
        <p
          ref={confirmation}
          tabIndex={-1}
          role={justAdded ? "status" : undefined}
          className={cn("inline-flex items-center gap-2 outline-none", textCls, added && variant === "compact" && "text-bronze-text")}
        >
          {added ? (
            <>
              <span aria-hidden className="inline-block size-1.5 rounded-full bg-olive-deep" />
              Added to your enquiry list
              {sr}
            </>
          ) : (
            <>Your enquiry list is full ({MAX_LIST_ITEMS} products){sr}</>
          )}
        </p>
        <Link href={RFQ_PATH} className={cn(viewLinkCls, variant === "primary" ? "text-sm" : "text-xs")}>
          View your enquiry
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        addProduct(productId);
        setJustAdded(true);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium tracking-wide transition-colors rounded-sm",
        variant === "primary"
          ? "bg-charcoal px-7 py-3.5 text-sm text-ivory hover:bg-bronze-text"
          : "border border-charcoal/40 px-3 py-1.5 text-xs hover:border-charcoal hover:bg-charcoal hover:text-ivory",
        className,
      )}
    >
      Add to enquiry
      {sr}
    </button>
  );
}
