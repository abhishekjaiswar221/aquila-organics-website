"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, type FieldErrors, type FieldPath, type Resolver } from "react-hook-form";
import { submitContact } from "@/features/contact/actions";
import { contactConfirmationHref } from "@/features/contact/confirmation";
import { buildContactFormData, pristineContactValues, type ContactFormValues } from "@/features/contact/form-state";
import { CONTACT_MESSAGE_MAX, contactSchema, type ContactType } from "@/features/contact/schema";
import { checkSelectedFiles } from "@/features/enquiries/form-state";
import { HONEYPOT_FIELD, TEXT_LIMITS, type SubmitRfqResult } from "@/features/enquiries/schema";
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
  inputCls,
  newSubmissionId,
  problemsMessage,
} from "./form-fields";

/*
 * One Contact form (one per business segment on /contact). React Hook Form
 * validates with the shared contactSchema; the submitContact server action
 * validates again and is the authority. Its field errors are mapped back onto
 * the same fields.
 *
 * Idempotency: one submissionId per form instance, reused for every retry
 * (double click, retry after a lost response), so the server returns the same
 * reference instead of storing a duplicate. A fresh one only after success.
 */

export interface ApplicationOption {
  slug: string;
  name: string;
}

interface Props {
  type: ContactType;
  /** Prefilled application slug (already validated against the fixed list). */
  application?: string;
  /** The segment's applications; the select is shown only when given. */
  applications?: readonly ApplicationOption[];
  /** Id of the heading that names this form. */
  labelledBy?: string;
}

type FieldName = Exclude<FieldPath<ContactFormValues>, "type" | "submissionId" | typeof HONEYPOT_FIELD>;

/** Fields in DOM order, for the error summary. */
const FIELD_ORDER: FieldName[] = ["fullName", "companyName", "email", "phone", "country", "application", "message"];

export function ContactForm({ type, application, applications, labelledBy }: Props) {
  const router = useRouter();
  const prefix = `contact-${type.toLowerCase().replace(/_/g, "-")}`;
  const fieldId = (name: string) => `${prefix}-${name}`;

  const form = useForm<ContactFormValues>({
    // The form type allows an unticked consent (false); contactSchema rejects it.
    resolver: zodResolver(contactSchema) as unknown as Resolver<ContactFormValues>,
    defaultValues: pristineContactValues(type, application),
    mode: "onSubmit",
    reValidateMode: "onChange",
    // Focus is moved by hand to the first invalid field in DOM order.
    shouldFocusError: false,
  });
  const { register, formState, setError, getValues, setValue } = form;
  const errors = formState.errors;

  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  /** Reference of the message just sent, shown while the confirmation page opens. */
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
  const fileInput = useRef<HTMLInputElement>(null);
  const appliedApplication = useRef(application);

  // A new prefill from the URL (e.g. a consultation link followed while this
  // route is kept mounted) selects that application. Only an actual change of
  // the prop does: effects re-run when a hidden <Activity> is shown again, and
  // that must not overwrite what the visitor chose.
  useEffect(() => {
    if (application === appliedApplication.current) return;
    appliedApplication.current = application;
    if (application) setValue("application", application);
  }, [application, setValue]);

  // The "sent" note belongs to the navigation that followed it: drop it when
  // this route is hidden, so Back shows a clean form.
  useEffect(() => () => setSent(null), []);

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

  const problems: { id: string; message: string }[] = [];
  for (const key of FIELD_ORDER) {
    const message = errors[key]?.message;
    if (message) problems.push({ id: fieldId(key), message });
  }
  if (fileErrors.length) problems.push({ id: fieldId("attachments"), message: fileErrors[0] });
  if (errors.consent?.message) problems.push({ id: fieldId("consent"), message: errors.consent.message });

  const announceProblems = (count: number) => setAnnouncement(problemsMessage(count, "message"));

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
      else if ((FIELD_ORDER as string[]).includes(key) || key === "consent") {
        setError(key as FieldName | "consent", { type: "server", message });
      } else {
        // type, submissionId, the honeypot or anything unexpected: nothing the
        // visitor can fix in a field.
        setFormError(RELOAD_ERROR);
      }
    }
    announceProblems(count);
    failed();
  }

  function resetAfterSuccess() {
    form.reset(pristineContactValues(type, application));
    setFiles([]);
    setFileErrors([]);
    setFormError(null);
    setFailedOnce(false);
    setAnnouncement("");
    focusedTick.current = focusTick;
    if (honeypot.current) honeypot.current.value = "";
    if (fileInput.current) fileInput.current.value = "";
  }

  const onValid = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFormError(null);
    setAnnouncement("");
    submissionId.current ??= newSubmissionId();
    const fd = buildContactFormData(
      { ...getValues(), type, [HONEYPOT_FIELD]: honeypot.current?.value ?? "" },
      submissionId.current,
      files,
    );
    startTransition(async () => {
      let result: SubmitRfqResult;
      try {
        result = await submitContact(fd);
      } catch {
        // Keep everything, including the submissionId: a resend of a message
        // that did reach the server returns the same reference.
        inFlight.current = false;
        setFormError(NETWORK_ERROR);
        failed();
        return;
      }
      if (result.ok) {
        // Reset BEFORE navigating: with cacheComponents this component stays
        // mounted (hidden) and reappears on Back, so it must come back
        // pristine and usable. The submissionId is dropped, so the next
        // message gets a new one and this one cannot be re-sent.
        submissionId.current = null;
        resetAfterSuccess();
        inFlight.current = false;
        setSent(result.reference);
        router.push(contactConfirmationHref(result.reference));
        return;
      }
      inFlight.current = false;
      applyServerErrors(result);
    });
  };

  const onInvalid = (errs: FieldErrors<ContactFormValues>) => {
    setFormError(null);
    announceProblems(Math.max(1, countMessages(errs) + (fileErrors.length ? 1 : 0)));
    failed();
  };

  function onFiles(list: FileList | null) {
    const incoming = list ? [...list] : [];
    const { accepted, errors: errs } = checkSelectedFiles(files, incoming);
    setFiles((prev) => [...prev, ...accepted]);
    setFileErrors(errs);
    if (fileInput.current) fileInput.current.value = "";
  }

  const problemsTitleId = fieldId("problems-title");

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
      aria-labelledby={labelledBy}
      className="relative"
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {sent ? (
        <p role="status" className="mb-8 border-l-4 border-olive-deep bg-white p-5 text-sm leading-relaxed">
          Your message has been sent. Your reference is <span className="font-mono">{sent}</span>.{" "}
          <Link href={contactConfirmationHref(sent)} className="text-bronze-text underline underline-offset-4">
            View the confirmation
          </Link>
        </p>
      ) : null}

      {formError ? (
        <div
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
          className="mb-8 border-l-4 border-destructive bg-white p-5 text-sm font-medium leading-relaxed text-destructive outline-none focus-visible:outline-2"
        >
          {formError}
        </div>
      ) : null}

      {problems.length > 0 && failedOnce ? (
        <div aria-labelledby={problemsTitleId} className="mb-8 border border-destructive/60 bg-white p-5 sm:p-6">
          <h4 id={problemsTitleId} className="text-xl">
            {problems.length === 1 ? "There is 1 problem with your message" : `There are ${problems.length} problems with your message`}
          </h4>
          <ul className="mt-3 space-y-1.5 text-sm">
            {problems.map((p) => (
              <li key={p.id}>
                <a
                  href={`#${p.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(p.id)?.focus();
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

      <div className="grid gap-6 md:grid-cols-2">
        <FormField id={fieldId("fullName")} label="Full name" error={errors.fullName?.message}>
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
        </FormField>
        <FormField id={fieldId("companyName")} label="Company name" error={errors.companyName?.message}>
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
        </FormField>
        <FormField id={fieldId("email")} label="Business email" error={errors.email?.message}>
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
        </FormField>
        <FormField
          id={fieldId("phone")}
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
        </FormField>
        <FormField id={fieldId("country")} label="Country" error={errors.country?.message}>
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
        </FormField>
        {applications ? (
          <FormField id={fieldId("application")} label="Application (optional)" error={errors.application?.message}>
            {(a11y) => (
              <select {...a11y} className={inputCls} {...register("application")}>
                <option value="">Not specified</option>
                {applications.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        ) : null}
        <FormField
          id={fieldId("message")}
          label="Message"
          hint="What you are working on, and anything that helps us respond: volumes, timing or documents you need."
          error={errors.message?.message}
          className="md:col-span-2"
        >
          {(a11y) => (
            <textarea
              {...a11y}
              rows={6}
              maxLength={CONTACT_MESSAGE_MAX}
              className={cn(controlCls, "py-3 leading-relaxed")}
              {...register("message")}
            />
          )}
        </FormField>
        <div className="min-w-0 md:col-span-2">
          <AttachmentsField
            id={fieldId("attachments")}
            inputRef={fileInput}
            files={files}
            errors={fileErrors}
            hint={attachmentRulesHint("A brief or specification helps us respond accurately.")}
            onFiles={onFiles}
            onRemove={(i) => {
              setFiles((prev) => prev.filter((_, j) => j !== i));
              setFileErrors([]);
              fileInput.current?.focus();
            }}
          />
        </div>
      </div>

      <HoneypotField id={fieldId("website")} inputRef={honeypot} />

      <div className="mt-10 border-t border-charcoal pt-8">
        <ConsentField id={fieldId("consent")} error={errors.consent?.message} registration={register("consent")} />
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-charcoal px-8 py-3.5 text-sm font-medium tracking-wide text-ivory transition-colors hover:bg-bronze-text disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? "Sending your message\u{2026}" : "Send message"}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            {isPending ? "Please wait, this can take a moment with attachments." : "You will receive a reference number."}
          </p>
        </div>
      </div>
    </form>
  );
}
