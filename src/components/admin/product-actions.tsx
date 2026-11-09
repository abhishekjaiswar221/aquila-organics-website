"use client";

import { useActionState } from "react";
import type { ProductStatus } from "@/generated/prisma/enums";
import { submitProductStatus, submitProductVerified, type ProductFormState } from "@/features/products/admin-actions";
import { secondaryButtonCls } from "./ui";

type Props = {
  productId: string;
  productName: string;
  status: ProductStatus;
  verified: boolean;
  canVerify: boolean;
};

function Message({ state }: { state: ProductFormState }) {
  if (!state) return null;
  return (
    <span className={state.ok ? "text-olive-deep" : "font-medium text-destructive"}>{state.message}</span>
  );
}

/** Row actions: publish/unpublish/archive for both admin roles; verification for super admins. */
export function ProductActions({ productId, productName, status, verified, canVerify }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(submitProductStatus, null);
  const [verifyState, verifyAction, verifyPending] = useActionState(submitProductVerified, null);
  const pending = statusPending || verifyPending;
  // The latest message wins; each region is always present so screen readers announce changes.
  const target = (to: ProductStatus, label: string) => (
    <form action={statusAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="status" value={to} />
      <button type="submit" disabled={pending} className={secondaryButtonCls}>
        {label}
        <span className="sr-only">: {productName}</span>
      </button>
    </form>
  );

  return (
    <div className="flex min-w-48 flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {status !== "PUBLISHED" ? target("PUBLISHED", "Publish") : null}
        {status === "PUBLISHED" ? target("DRAFT", "Unpublish") : null}
        {status === "ARCHIVED" ? target("DRAFT", "Restore to draft") : null}
        {status !== "ARCHIVED" ? target("ARCHIVED", "Archive") : null}
        {canVerify ? (
          <form action={verifyAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="verified" value={verified ? "false" : "true"} />
            <button type="submit" disabled={pending} className={secondaryButtonCls}>
              {verified ? (status === "PUBLISHED" ? "Mark unverified and unpublish" : "Mark unverified") : "Mark verified"}
              <span className="sr-only">: {productName}</span>
            </button>
          </form>
        ) : null}
      </div>
      <p aria-live="polite" className="max-w-72 text-xs leading-relaxed">
        <Message state={statusState} />
        {statusState && verifyState ? " " : null}
        <Message state={verifyState} />
      </p>
    </div>
  );
}
