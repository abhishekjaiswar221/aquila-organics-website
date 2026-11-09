"use client";

import { useEffect, useRef, useState } from "react";
import { addProduct, useEnquiryList } from "@/features/enquiries/store-client";
import { cn } from "@/lib/utils";

interface Props {
  productId: string;
  productName: string;
  /** "primary" on the product page, "compact" in list rows. */
  variant?: "primary" | "compact";
  className?: string;
}

/**
 * Adds the product id to the browser-side enquiry list (Task 9 store). Server
 * HTML always shows the button; after hydration it reflects the stored list.
 */
export function AddToEnquiryButton({ productId, productName, variant = "primary", className }: Props) {
  const list = useEnquiryList();
  const added = list.includes(productId.toLowerCase());
  const [justAdded, setJustAdded] = useState(false);
  const confirmation = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // The button unmounts on click; keep keyboard focus on its replacement.
    if (justAdded) confirmation.current?.focus();
  }, [justAdded]);

  if (added) {
    // TODO(task-10): link to /rfq once the enquiry page exists.
    return (
      <p
        ref={confirmation}
        tabIndex={-1}
        role={justAdded ? "status" : undefined}
        className={cn(
          "inline-flex items-center gap-2 outline-none",
          variant === "primary" ? "py-3.5 text-sm font-medium" : "font-mono text-xs text-bronze-text",
          className,
        )}
      >
        <span aria-hidden className="inline-block size-1.5 rounded-full bg-olive-deep" />
        Added to your enquiry list
        {variant === "compact" ? <span className="sr-only">: {productName}</span> : null}
      </p>
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
      {variant === "compact" ? <span className="sr-only">: {productName}</span> : null}
    </button>
  );
}
