import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { ATTACHMENT_ACCEPT, formatFileSize } from "@/features/enquiries/form-state";
import { HONEYPOT_FIELD, MAX_ATTACHMENTS } from "@/features/enquiries/schema";
import { cn } from "@/lib/utils";

/*
 * Small building blocks shared by the enquiry forms (RFQ and Contact). Pure
 * presentation: each form keeps its own state, ids and submit logic.
 */

export const NETWORK_ERROR =
  "We could not reach our server, so your enquiry may not have been sent. Check your connection and try again: your details are still here, and sending again will not create a duplicate.";
export const RELOAD_ERROR = "Something went wrong with this form. Please reload the page and try again.";

export const labelCls = "block text-sm font-medium text-charcoal";
export const hintCls = "mt-1.5 text-xs leading-relaxed text-muted-foreground";
export const errorCls = "mt-1.5 text-sm font-medium text-destructive";
export const controlCls =
  "mt-2 block w-full min-w-0 rounded-sm border border-charcoal/40 bg-white px-3 text-base text-charcoal placeholder:text-muted-foreground focus-visible:border-charcoal aria-invalid:border-destructive aria-invalid:border-2";
export const inputCls = `${controlCls} h-12`;

/** One idempotency token per form instance (crypto.randomUUID with a v4 fallback). */
export function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for non-secure contexts: RFC 4122 v4 from getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function describedBy(...ids: unknown[]): string | undefined {
  const list = ids.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
  return list || undefined;
}

/** Number of distinct field messages in a (nested) React Hook Form errors object. */
export function countMessages(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  if ("message" in node && typeof node.message === "string" && node.message) return 1;
  return Object.entries(node).reduce((n, [key, value]) => (key === "ref" ? n : n + countMessages(value)), 0);
}

export function problemsMessage(count: number, noun: string): string {
  return count === 1
    ? `There is 1 problem with your ${noun}. It is described next to the field.`
    : `There are ${count} problems with your ${noun}. Each is described next to its field.`;
}

export type FieldA11y = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  extraHint?: ReactNode;
  className?: string;
  children: (a11y: FieldA11y) => ReactNode;
};

/** Label, control, hint and error wired together with ids. */
export function FormField({ id, label, error, hint, extraHint, className, children }: FormFieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy(hint && `${id}-hint`, extraHint && `${id}-extra`, error && `${id}-error`),
      })}
      {hint ? (
        <p id={`${id}-hint`} className={hintCls}>
          {hint}
        </p>
      ) : null}
      {extraHint ? (
        <p id={`${id}-extra`} className="mt-1.5 text-xs leading-relaxed text-bronze-text">
          {extraHint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={errorCls}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type AttachmentsFieldProps = {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  files: readonly File[];
  errors: readonly string[];
  hint: ReactNode;
  onFiles: (list: FileList | null) => void;
  onRemove: (index: number) => void;
};

/** Optional attachments: file input, rules hint, errors and the removable list of selected files. */
export function AttachmentsField({ id, inputRef, files, errors, hint, onFiles, onRemove }: AttachmentsFieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>
        Attachments (optional)
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        aria-invalid={errors.length ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, errors.length > 0 && `${id}-error`)}
        onChange={(e) => onFiles(e.currentTarget.files)}
        className="mt-2 block w-full min-w-0 text-sm text-muted-foreground file:mr-4 file:cursor-pointer file:rounded-sm file:border file:border-charcoal/40 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-charcoal hover:file:border-charcoal"
      />
      <p id={`${id}-hint`} className={hintCls}>
        {hint}
      </p>
      {errors.length ? (
        <div id={`${id}-error`} className={errorCls}>
          {errors.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <ul aria-label="Selected files" className="mt-4 divide-y divide-charcoal/15 border-y border-charcoal/15">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-4 py-2.5">
              <span className="min-w-0 wrap-break-word text-sm">
                {f.name}{" "}
                <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onRemove(i)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:text-charcoal"
              >
                <X aria-hidden className="size-3.5" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The standard attachment rules sentence (the server is authoritative). */
export function attachmentRulesHint(extra?: string): string {
  return `PDF, PNG, JPG, DOCX, XLSX or CSV. Up to ${MAX_ATTACHMENTS} files, 10 MB each.${extra ? ` ${extra}` : ""}`;
}

/** Honeypot: invisible, unfocusable and hidden from assistive technology. */
export function HoneypotField({ id, inputRef }: { id: string; inputRef: RefObject<HTMLInputElement | null> }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] top-0 h-px w-px overflow-hidden">
      <label htmlFor={id}>Leave this field empty</label>
      <input ref={inputRef} id={id} type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

/** Required consent checkbox with the privacy notice link. */
export function ConsentField({
  id,
  error,
  registration,
  label = "I agree to Aquila Organics using these details to respond to my enquiry.",
}: {
  id: string;
  error?: string;
  registration: UseFormRegisterReturn;
  label?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, error && `${id}-error`)}
        className="mt-1 size-5 shrink-0 accent-charcoal aria-invalid:outline-2 aria-invalid:outline-destructive"
        {...registration}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium leading-relaxed">
          {label}
        </label>
        <p id={`${id}-hint`} className={hintCls}>
          How we handle your information is explained in our{" "}
          <Link href="/privacy" className="text-bronze-text underline underline-offset-4">
            privacy notice
          </Link>
          .
        </p>
        {error ? (
          <p id={`${id}-error`} className={errorCls}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
