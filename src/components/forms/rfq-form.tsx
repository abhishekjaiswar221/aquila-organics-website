"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors, type FieldPath, type Resolver } from "react-hook-form";
import { contacts } from "@/content/site";
import { getEnquiryProducts, submitRfq, type EnquiryProduct } from "@/features/enquiries/actions";
import { confirmationHref } from "@/features/enquiries/confirmation";
import {
  buildRfqFormData,
  checkSelectedFiles,
  emptyLine,
  mergeSavedLines,
  pristineValues,
  type RfqFormValues,
} from "@/features/enquiries/form-state";
import {
  BUSINESS_SEGMENTS,
  BUSINESS_SEGMENT_LABELS,
  HONEYPOT_FIELD,
  MAX_ITEMS,
  TEXT_LIMITS,
  UNITS,
  UNIT_LABELS,
  isFreeMailAddress,
  rfqSchema,
  type SubmitRfqResult,
} from "@/features/enquiries/schema";
import { clearList, getList, removeProduct } from "@/features/enquiries/store-client";
import { CATALOGUE_PATH } from "@/lib/seo/site-url";
import { cn } from "@/lib/utils";
import {
  AttachmentsField,
  ConsentField,
  FormField,
  HoneypotField,
  NETWORK_ERROR,
  RELOAD_ERROR,
  attachmentRulesHint,
  controlCls,
  countMessages,
  describedBy,
  errorCls,
  inputCls,
  newSubmissionId,
  problemsMessage,
  type FieldA11y,
} from "./form-fields";

/*
 * The RFQ form. React Hook Form validates with the shared rfqSchema; the
 * submitRfq server action validates again and is the authority. Its field
 * errors are mapped back onto the same field paths.
 *
 * Idempotency: one submissionId per form instance, reused for every retry
 * (double click, retry after a lost response), so the server returns the same
 * reference instead of storing a duplicate. A fresh one only after success.
 */

function droppedMessage(n: number): string {
  return n === 1
    ? "1 saved product is no longer available and was removed from your list."
    : `${n} saved products are no longer available and were removed from your list.`;
}

const fieldId = (path: string) => `rfq-${path.replace(/\./g, "-")}`;

type FieldProps = {
  path: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  extraHint?: ReactNode;
  className?: string;
  children: (a11y: FieldA11y) => ReactNode;
};

/** The shared FormField with this form's id scheme. */
function Field({ path, ...props }: FieldProps) {
  return <FormField id={fieldId(path)} {...props} />;
}

function SectionTitle({ n, children, id }: { n: string; children: ReactNode; id: string }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-charcoal pb-3">
      <span aria-hidden className="font-mono text-xs tracking-[0.16em] text-bronze-text">
        {n}
      </span>
      <h2 id={id} className="text-2xl sm:text-3xl">
        {children}
      </h2>
    </div>
  );
}

type LoadState = "loading" | "ready";

export function RfqForm() {
  const router = useRouter();
  const form = useForm<RfqFormValues>({
    // The form type allows an unchosen unit (""); rfqSchema rejects it with "Choose a unit".
    resolver: zodResolver(rfqSchema) as unknown as Resolver<RfqFormValues>,
    defaultValues: pristineValues(),
    mode: "onSubmit",
    reValidateMode: "onChange",
    // Focus is moved by hand to the first invalid field in DOM order (lines
    // register after the saved list loads, so registration order differs).
    shouldFocusError: false,
  });
  const { register, control, formState, setError, getValues } = form;
  const errors = formState.errors;
  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });

  const [load, setLoad] = useState<LoadState>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, EnquiryProduct>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  /** Reference of the enquiry just sent, shown while the confirmation page opens. */
  const [sent, setSent] = useState<string | null>(null);
  const [failedOnce, setFailedOnce] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [focusTick, setFocusTick] = useState(0);
  const [isPending, startTransition] = useTransition();

  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const focusedTick = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Saved catalogue ids -> lines (published products only), MERGED into what
  // is already there. With cacheComponents, Next keeps this route mounted in a
  // hidden <Activity> and re-runs effects when it becomes visible again, so
  // this must never replace typed lines: mergeSavedLines only appends products
  // that are not yet present (or fills a form that has no typed line at all).
  useEffect(() => {
    let cancelled = false;
    const ids = getList();
    const apply = (products: EnquiryProduct[], message: string | null) => {
      if (cancelled) return;
      setSent(null);
      const { mode, lines } = mergeSavedLines(getValues("items") ?? [], products);
      if (mode === "replace") replace(lines);
      else if (mode === "append") append(lines, { shouldFocus: false });
      if (products.length) {
        setDetails((prev) => ({ ...prev, ...Object.fromEntries(products.map((p) => [p.id.toLowerCase(), p])) }));
      }
      setNotice(message);
      setLoad("ready");
    };
    if (ids.length === 0) {
      apply([], null);
      return () => {
        cancelled = true;
      };
    }
    getEnquiryProducts(ids).then(
      (products) => {
        if (cancelled) return;
        const byId = new Map(products.map((p) => [p.id.toLowerCase(), p]));
        const found = ids.flatMap((id) => {
          const p = byId.get(id);
          return p ? [p] : [];
        });
        const missing = ids.filter((id) => !byId.has(id));
        for (const id of missing) removeProduct(id);
        apply(found, missing.length ? droppedMessage(missing.length) : null);
      },
      () =>
        apply(
          [],
          "We could not load your saved products just now. You can add them by name below, or reload the page to try again.",
        ),
    );
    return () => {
      cancelled = true;
    };
  }, [append, getValues, replace]);

  // After a failed submit: focus the form-level error, else the first invalid
  // field in DOM order. Runs after every render until the error markup exists
  // (React Hook Form may commit its errors in a later render than ours).
  useEffect(() => {
    if (focusTick === focusedTick.current) return;
    const target =
      formErrorRef.current ?? formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? null;
    if (!target) return;
    focusedTick.current = focusTick;
    target.focus();
  });

  const items = useWatch({ control, name: "items" });
  const email = useWatch({ control, name: "email" });
  const itemsError = errors.items?.root?.message ?? errors.items?.message;

  type Problem = { path: string; message: string };
  const problems: Problem[] = [];
  const push = (path: string, message: string | undefined) => {
    if (message) problems.push({ path, message });
  };
  push("items", itemsError);
  fields.forEach((_, i) => {
    const e = errors.items?.[i];
    push(`items.${i}.name`, e?.name?.message);
    push(`items.${i}.quantity`, e?.quantity?.message);
    push(`items.${i}.unit`, e?.unit?.message);
    push(`items.${i}.notes`, e?.notes?.message);
  });
  for (const key of ["fullName", "companyName", "email", "phone", "country", "businessSegment"] as const) {
    push(key, errors[key]?.message);
  }
  push("intendedApplication", errors.intendedApplication?.message);
  push("additionalRequirements", errors.additionalRequirements?.message);
  if (fileErrors.length) push("attachments", fileErrors[0]);
  push("consent", errors.consent?.message);

  const announceProblems = (count: number) => {
    setAnnouncement(problemsMessage(count, "enquiry"));
  };

  const failed = () => {
    setFailedOnce(true);
    setFocusTick((t) => t + 1);
  };

  function applyServerErrors(result: Extract<SubmitRfqResult, { ok: false }>) {
    const errs = result.errors;
    if ("form" in errs && typeof errs.form === "string") {
      setFormError(errs.form);
      failed();
      return;
    }
    let count = 0;
    for (const [key, messages] of Object.entries(errs as Record<string, string[]>)) {
      const message = messages[0];
      if (!message) continue;
      count += 1;
      if (key === "attachments") setFileErrors(messages);
      else if (key === "items" || key === "items.root") setError("items", { type: "server", message });
      else if (key === "submissionId" || key === HONEYPOT_FIELD || key === "_form") setFormError(RELOAD_ERROR);
      else setError(key as FieldPath<RfqFormValues>, { type: "server", message });
    }
    announceProblems(count);
    failed();
  }

  const onValid = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFormError(null);
    setAnnouncement("");
    submissionId.current ??= newSubmissionId();
    const values = getValues();
    const fd = buildRfqFormData(
      { ...values, [HONEYPOT_FIELD]: honeypot.current?.value ?? "" },
      submissionId.current,
      files,
    );
    startTransition(async () => {
      let result: SubmitRfqResult;
      try {
        result = await submitRfq(fd);
      } catch {
        inFlight.current = false;
        setFormError(NETWORK_ERROR);
        failed();
        return;
      }
      if (result.ok) {
        // Reset BEFORE navigating: with cacheComponents this component stays
        // mounted (hidden) and reappears on Back or via the header link, so
        // it must come back pristine and usable. The submissionId is dropped,
        // so the next enquiry gets a new one and this one cannot be re-sent.
        // If navigation does not happen, the visitor still sees the
        // reference with a link to the confirmation, and a working form.
        clearList();
        submissionId.current = null;
        resetAfterSuccess();
        inFlight.current = false;
        setSent(result.reference);
        router.push(confirmationHref(result.reference));
        return;
      }
      inFlight.current = false;
      applyServerErrors(result);
    });
  };

  const onInvalid = (errs: FieldErrors<RfqFormValues>) => {
    setFormError(null);
    announceProblems(Math.max(1, countMessages(errs) + (fileErrors.length ? 1 : 0)));
    failed();
  };

  function resetAfterSuccess() {
    form.reset({ ...pristineValues(), items: [emptyLine()] });
    setFiles([]);
    setFileErrors([]);
    setFormError(null);
    setFailedOnce(false);
    setAnnouncement("");
    setNotice(null);
    setDetails({});
    focusedTick.current = focusTick;
    if (honeypot.current) honeypot.current.value = "";
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeLine(index: number) {
    const productId = getValues(`items.${index}.productId`);
    if (productId) removeProduct(productId);
    if (fields.length === 1) replace([emptyLine()]);
    else remove(index);
    addButton.current?.focus();
  }

  function onFiles(list: FileList | null) {
    const incoming = list ? [...list] : [];
    const { accepted, errors: errs } = checkSelectedFiles(files, incoming);
    setFiles((prev) => [...prev, ...accepted]);
    setFileErrors(errs);
    if (fileInput.current) fileInput.current.value = "";
  }

  const showFreeMailHint =
    failedOnce && !errors.email && typeof email === "string" && email.includes("@") && isFreeMailAddress(email.trim());
  const attachmentsId = fieldId("attachments");

  return (
    <form
      ref={formRef}
      noValidate
      // Defence in depth: a click before hydration, or with JavaScript off, must never put the
      // visitor's details in the URL (a native GET would). POST sends them in the body instead.
      method="post"
      onSubmit={(e) => {
        // handleSubmit prevents the native submission.
        void form.handleSubmit(onValid, onInvalid)(e);
      }}
      aria-labelledby="rfq-form-title"
      className="relative"
    >
      <h2 id="rfq-form-title" className="sr-only">
        Request for quotation form
      </h2>

      <noscript>
        <p className="mb-8 border border-charcoal bg-white p-5 text-sm">
          This form needs JavaScript. You can also send your enquiry by email to{" "}
          <a href={`mailto:${contacts.sales}`} className="underline underline-offset-4">
            {contacts.sales}
          </a>
          .
        </p>
      </noscript>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {sent ? (
        <p role="status" className="mb-10 border-l-4 border-olive-deep bg-white p-5 text-sm leading-relaxed">
          Your enquiry has been sent. Your reference is <span className="font-mono">{sent}</span>.{" "}
          <Link href={confirmationHref(sent)} className="text-bronze-text underline underline-offset-4">
            View the confirmation
          </Link>
        </p>
      ) : null}

      {formError ? (
        <div
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
          className="mb-10 border-l-4 border-destructive bg-white p-5 text-sm font-medium leading-relaxed text-destructive outline-none focus-visible:outline-2"
        >
          {formError}
        </div>
      ) : null}

      {problems.length > 0 && failedOnce ? (
        <div aria-labelledby="rfq-problems-title" className="mb-10 border border-destructive/60 bg-white p-5 sm:p-6">
          <h3 id="rfq-problems-title" className="text-xl">
            {problems.length === 1 ? "There is 1 problem with your enquiry" : `There are ${problems.length} problems with your enquiry`}
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {problems.map((p) => (
              <li key={p.path}>
                <a
                  href={`#${fieldId(p.path === "items" ? "items-add" : p.path)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(fieldId(p.path === "items" ? "items-add" : p.path))?.focus();
                  }}
                  className="text-destructive underline underline-offset-4"
                >
                  {p.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 01 Products */}
      <section aria-labelledby="rfq-products-title">
        <SectionTitle n="01" id="rfq-products-title">
          Products and quantities
        </SectionTitle>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Products you saved from the catalogue appear here. You can also add products by name, for example something
          not listed online.{" "}
          <Link href={CATALOGUE_PATH} className="text-bronze-text underline underline-offset-4">
            Browse the catalogue
          </Link>
        </p>

        <div role="status" className="mt-4 text-sm empty:hidden">
          {load === "loading" ? "Loading your saved products\u{2026}" : notice}
        </div>

        <div className="mt-6 space-y-5">
          {fields.map((field, i) => {
            const productId = items?.[i]?.productId;
            const product = productId ? details[productId.toLowerCase()] : undefined;
            const lineErrors = errors.items?.[i];
            const name = items?.[i]?.name ?? "";
            return (
              <fieldset key={field.id} className="min-w-0 border border-charcoal/25 bg-white p-5 sm:p-6">
                <legend className="sr-only">
                  {`Product ${i + 1}${product ? `: ${product.name}` : ""}`}
                </legend>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p aria-hidden className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Product {String(i + 1).padStart(2, "0")}
                      {product ? " \u{00B7} From the catalogue" : ""}
                    </p>
                    {product ? (
                      <>
                        <p className="mt-2 text-lg font-medium leading-snug">{product.name}</p>
                        {product.casNumber ? (
                          <p className="mt-1 font-mono text-sm text-muted-foreground">
                            <span className="sr-only">CAS number </span>
                            <span aria-hidden>CAS </span>
                            {product.casNumber}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="-mr-2 -mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:text-charcoal"
                  >
                    <X aria-hidden className="size-3.5" />
                    Remove
                    <span className="sr-only"> {product?.name || name || `product ${i + 1}`}</span>
                  </button>
                </div>

                <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  {product ? null : (
                    <Field
                      path={`items.${i}.name`}
                      label="Product name"
                      hint="Name, product code or CAS number if you have it."
                      error={lineErrors?.name?.message}
                      className="sm:col-span-2 lg:col-span-1"
                    >
                      {(a11y) => (
                        <input
                          {...a11y}
                          type="text"
                          maxLength={TEXT_LIMITS.itemName}
                          autoComplete="off"
                          className={inputCls}
                          {...register(`items.${i}.name`)}
                        />
                      )}
                    </Field>
                  )}
                  <Field path={`items.${i}.quantity`} label="Quantity" error={lineErrors?.quantity?.message}>
                    {(a11y) => (
                      <input
                        {...a11y}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className={cn(inputCls, "font-mono")}
                        {...register(`items.${i}.quantity`)}
                      />
                    )}
                  </Field>
                  <Field path={`items.${i}.unit`} label="Unit" error={lineErrors?.unit?.message}>
                    {(a11y) => (
                      <select {...a11y} className={inputCls} {...register(`items.${i}.unit`)}>
                        <option value="" disabled>
                          Select unit
                        </option>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {UNIT_LABELS[u]}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field
                    path={`items.${i}.notes`}
                    label="Notes (optional)"
                    error={lineErrors?.notes?.message}
                    className="sm:col-span-2 lg:col-span-3"
                  >
                    {(a11y) => (
                      <input
                        {...a11y}
                        type="text"
                        maxLength={TEXT_LIMITS.itemNotes}
                        placeholder="Grade, packaging, delivery schedule"
                        className={inputCls}
                        {...register(`items.${i}.notes`)}
                      />
                    )}
                  </Field>
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            ref={addButton}
            id={fieldId("items-add")}
            type="button"
            disabled={load === "loading" || fields.length >= MAX_ITEMS}
            aria-describedby={describedBy(fields.length >= MAX_ITEMS && "rfq-items-limit", itemsError && "rfq-items-error")}
            onClick={() => append(emptyLine(), { shouldFocus: true, focusName: `items.${fields.length}.name` })}
            className="inline-flex items-center gap-2 rounded-sm border border-charcoal/40 px-4 py-2.5 text-sm font-medium hover:border-charcoal hover:bg-charcoal hover:text-ivory disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus aria-hidden className="size-4" />
            Add another product
          </button>
          {fields.length >= MAX_ITEMS ? (
            <p id="rfq-items-limit" className="text-xs text-muted-foreground">
              One enquiry can hold up to {MAX_ITEMS} products.
            </p>
          ) : null}
          {itemsError ? (
            <p id="rfq-items-error" className={errorCls}>
              {itemsError}
            </p>
          ) : null}
        </div>
      </section>

      {/* 02 Contact */}
      <section aria-labelledby="rfq-contact-title" className="mt-16">
        <SectionTitle n="02" id="rfq-contact-title">
          Your details
        </SectionTitle>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field path="fullName" label="Full name" error={errors.fullName?.message}>
            {(a11y) => (
              <input
                {...a11y}
                type="text"
                autoComplete="name"
                maxLength={TEXT_LIMITS.fullName}
                className={inputCls}
                {...register("fullName")}
              />
            )}
          </Field>
          <Field path="companyName" label="Company name" error={errors.companyName?.message}>
            {(a11y) => (
              <input
                {...a11y}
                type="text"
                autoComplete="organization"
                maxLength={TEXT_LIMITS.companyName}
                className={inputCls}
                {...register("companyName")}
              />
            )}
          </Field>
          <Field
            path="email"
            label="Business email"
            error={errors.email?.message}
            extraHint={
              showFreeMailHint
                ? "This looks like a personal email address. A company address helps us reply with a quotation sooner. You can still send it as it is."
                : undefined
            }
          >
            {(a11y) => (
              <input
                {...a11y}
                type="email"
                autoComplete="email"
                spellCheck={false}
                maxLength={TEXT_LIMITS.email}
                className={inputCls}
                {...register("email")}
              />
            )}
          </Field>
          <Field
            path="phone"
            label="Telephone"
            hint="Include the country code, for example +91."
            error={errors.phone?.message}
          >
            {(a11y) => (
              <input
                {...a11y}
                type="tel"
                autoComplete="tel"
                maxLength={TEXT_LIMITS.phone}
                className={inputCls}
                {...register("phone")}
              />
            )}
          </Field>
          <Field path="country" label="Country" error={errors.country?.message}>
            {(a11y) => (
              <input
                {...a11y}
                type="text"
                autoComplete="country-name"
                maxLength={TEXT_LIMITS.country}
                className={inputCls}
                {...register("country")}
              />
            )}
          </Field>
          <Field path="businessSegment" label="Business segment" error={errors.businessSegment?.message}>
            {(a11y) => (
              <select {...a11y} defaultValue="" className={inputCls} {...register("businessSegment")}>
                <option value="" disabled>
                  Choose a segment
                </option>
                {BUSINESS_SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {BUSINESS_SEGMENT_LABELS[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </section>

      {/* 03 Application and documents */}
      <section aria-labelledby="rfq-more-title" className="mt-16">
        <SectionTitle n="03" id="rfq-more-title">
          Application and documents
        </SectionTitle>
        <div className="mt-6 grid gap-6">
          <Field
            path="intendedApplication"
            label="Intended application (optional)"
            hint="What the products are for, for example a fine fragrance, a detergent or a beverage."
            error={errors.intendedApplication?.message}
          >
            {(a11y) => (
              <textarea
                {...a11y}
                rows={3}
                maxLength={TEXT_LIMITS.intendedApplication}
                className={cn(controlCls, "py-3 leading-relaxed")}
                {...register("intendedApplication")}
              />
            )}
          </Field>
          <Field
            path="additionalRequirements"
            label="Additional requirements (optional)"
            hint="Specifications, packaging, documents you need, delivery location or timing."
            error={errors.additionalRequirements?.message}
          >
            {(a11y) => (
              <textarea
                {...a11y}
                rows={5}
                maxLength={TEXT_LIMITS.additionalRequirements}
                className={cn(controlCls, "py-3 leading-relaxed")}
                {...register("additionalRequirements")}
              />
            )}
          </Field>

          <AttachmentsField
            id={attachmentsId}
            inputRef={fileInput}
            files={files}
            errors={fileErrors}
            hint={attachmentRulesHint("A specification or target sheet helps us quote accurately.")}
            onFiles={onFiles}
            onRemove={(i) => {
              setFiles((prev) => prev.filter((_, j) => j !== i));
              setFileErrors([]);
              fileInput.current?.focus();
            }}
          />
        </div>
      </section>

      <HoneypotField id="rfq-website" inputRef={honeypot} />

      {/* Consent and send */}
      <div className="mt-16 border-t border-charcoal pt-8">
        <ConsentField id={fieldId("consent")} error={errors.consent?.message} registration={register("consent")} />

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="submit"
            disabled={isPending || load === "loading"}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-charcoal px-8 py-3.5 text-sm font-medium tracking-wide text-ivory transition-colors hover:bg-bronze-text disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? "Sending your enquiry\u{2026}" : "Send enquiry"}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            {isPending ? "Please wait, this can take a moment with attachments." : "You will receive a reference number."}
          </p>
        </div>
      </div>
    </form>
  );
}
