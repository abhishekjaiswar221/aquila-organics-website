"use client";

import Link from "next/link";
import { RFQ_PATH } from "@/features/enquiries/confirmation";
import { useEnquiryList } from "@/features/enquiries/store-client";
import { cn } from "@/lib/utils";

/**
 * Header link to the RFQ page with the saved-product count. The store's server
 * snapshot is empty, so server HTML and the hydration pass render a plain
 * "Enquiry" link; the count appears once the browser list is read.
 */
export function EnquiryLink({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const count = useEnquiryList().length;
  const label = count > 0 ? `Enquiry list, ${count} ${count === 1 ? "product" : "products"}` : "Enquiry list";
  return (
    <Link
      href={RFQ_PATH}
      aria-label={label}
      onClick={onNavigate}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium tracking-wide underline-offset-4 decoration-1 hover:text-bronze-text hover:underline",
        className,
      )}
    >
      {count > 0 ? `Enquiry (${count})` : "Enquiry"}
    </Link>
  );
}
