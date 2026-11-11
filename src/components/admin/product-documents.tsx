"use client";

import { useActionState } from "react";
import { deleteProductDocument, uploadProductDocument } from "@/features/products/document-actions";
import type { ProductDocumentRow } from "@/features/products/edit-queries";
import { ATTACHMENT_EXTENSIONS } from "@/features/enquiries/attachment-rules";
import { SectionTitle, buttonCls, inputCls, labelCls, secondaryButtonCls } from "./ui";

const KIND_LABELS = { DATASHEET: "Datasheet", SDS: "Safety data sheet", OTHER: "Other" } as const;
const ACCEPT = ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

function DeleteButton({ id, title }: { id: string; title: string }) {
  const [state, action, pending] = useActionState(deleteProductDocument, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={secondaryButtonCls} disabled={pending} aria-label={`Delete document ${title}`}>
        {pending ? "Deleting..." : "Delete"}
      </button>
      {state && !state.ok ? (
        <span role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function ProductDocuments({ productId, documents }: { productId: string; documents: ProductDocumentRow[] }) {
  const [state, action, pending] = useActionState(uploadProductDocument, null);
  return (
    <section aria-labelledby="documents-title" className="mt-10 border-t border-charcoal/20 pt-6">
      <SectionTitle id="documents-title">Documents</SectionTitle>
      {documents.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-charcoal/15 border-y border-charcoal/15">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 break-words">
                <span className="mr-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {KIND_LABELS[d.kind]}
                </span>
                {d.title}
              </span>
              <DeleteButton id={d.id} title={d.title} />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-6 grid max-w-2xl gap-4">
        <input type="hidden" name="productId" value={productId} />
        <div>
          <label htmlFor="doc-kind" className={labelCls}>
            Type
          </label>
          <select id="doc-kind" name="kind" className={inputCls} defaultValue="DATASHEET" required>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="doc-title" className={labelCls}>
            Title
          </label>
          <input id="doc-title" name="title" type="text" maxLength={200} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="doc-file" className={labelCls}>
            File
          </label>
          <input id="doc-file" name="file" type="file" accept={ACCEPT} required className={inputCls} />
          <p className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPEG, CSV, DOCX or XLSX, up to 10 MB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonCls} disabled={pending}>
            {pending ? "Uploading..." : "Upload document"}
          </button>
          <p role="status" className={state?.ok === false ? "text-sm font-medium text-destructive" : "text-sm"}>
            {state?.message}
          </p>
        </div>
      </form>
    </section>
  );
}
