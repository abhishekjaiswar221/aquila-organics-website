"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { CareersFormNotice, ApplicantFields, CvField } from "@/components/careers/apply-fields";
import {
  ConsentField,
  HoneypotField,
  NETWORK_ERROR,
  RELOAD_ERROR,
  countMessages,
  newSubmissionId,
  problemsMessage,
} from "@/components/forms/form-fields";
import { careersConsentLabel } from "@/content/careers";
import { submitApplication } from "@/features/careers/actions";
import { applicationSchema } from "@/features/careers/application-schema";
import {
  CV_FIELD,
  buildApplicationFormData,
  checkSelectedCv,
  pristineApplicationValues,
  type ApplicationFormValues,
} from "@/features/careers/form-state";
import { CAREERS_APPLY_PATH, applicationConfirmationHref } from "@/features/careers/paths";
import { HONEYPOT_FIELD, type SubmitRfqResult } from "@/features/enquiries/schema";

/*
 * The careers application form. React Hook Form validates the text fields with
 * the shared applicationSchema; the submitApplication server action validates
 * again (including the CV's extension and content) and is the authority.
 * The CV is a single file held outside React Hook Form.
 *
 * Idempotency: one submissionId per form instance, reused for every retry, so
 * a resend returns the same reference. A fresh one only after success.
 * The opening (`job`) is a slug validated on the server; an unpublished one
 * silently becomes a general application there.
 */

interface Props {
  /** A currently published opening to apply for, or null for a general application. */
  job: { slug: string; title: string } | null;
  /** Id of the heading that names this form. */
  labelledBy?: string;
}

const NETWORK_ERROR_APPLICATION = NETWORK_ERROR.replace("your enquiry", "your application");

const PREFIX = "careers-apply";
const fieldId = (name: string) => `${PREFIX}-${name}`;

type FieldName = "fullName" | "email" | "phone" | "country" | "message";
const FIELD_ORDER: FieldName[] = ["fullName", "email", "phone", "country", "message"];

export function ApplicationForm({ job, labelledBy }: Props) {
  const router = useRouter();

  const form = useForm<ApplicationFormValues>({
    // The form type allows an unticked consent (false); applicationSchema rejects it.
    resolver: zodResolver(applicationSchema) as unknown as Resolver<ApplicationFormValues>,
    defaultValues: pristineApplicationValues(job?.slug),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });
  const { register, formState, setError, getValues } = form;
  const errors = formState.errors;

  const [cv, setCv] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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

  // The "sent" note belongs to the navigation that followed it.
  useEffect(() => () => setSent(null), []);

  // After a failed submit: focus the form-level error, else the first invalid field in DOM order.
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
  if (cvError) problems.push({ id: fieldId("cv"), message: cvError });
  if (errors.consent?.message) problems.push({ id: fieldId("consent"), message: errors.consent.message });

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
      if (key === CV_FIELD) setCvError(message);
      else if ((FIELD_ORDER as string[]).includes(key) || key === "consent") {
        setError(key as FieldName | "consent", { type: "server", message });
      } else {
        // job, submissionId, the honeypot or anything unexpected: nothing the visitor can fix in a field.
        setFormError(RELOAD_ERROR);
      }
    }
    setAnnouncement(problemsMessage(count, "application"));
    failed();
  }

  function resetAfterSuccess() {
    form.reset(pristineApplicationValues(job?.slug));
    setCv(null);
    setCvError(null);
    setFormError(null);
    setFailedOnce(false);
    setAnnouncement("");
    focusedTick.current = focusTick;
    if (honeypot.current) honeypot.current.value = "";
    if (fileInput.current) fileInput.current.value = "";
  }

  const onValid = () => {
    if (inFlight.current) return;
    // A client-side hint only; the server checks the file again.
    const cvProblem = checkSelectedCv(cv);
    if (cvProblem) {
      setCvError(cvProblem);
      setAnnouncement(problemsMessage(1, "application"));
      failed();
      return;
    }
    inFlight.current = true;
    setFormError(null);
    setCvError(null);
    setAnnouncement("");
    submissionId.current ??= newSubmissionId();
    const fd = buildApplicationFormData(getValues(), submissionId.current, cv);
    fd.set(HONEYPOT_FIELD, honeypot.current?.value ?? "");
    startTransition(async () => {
      let result: SubmitRfqResult;
      try {
        result = await submitApplication(fd);
      } catch {
        // Keep everything, including the submissionId: a resend of an application that did
        // reach the server returns the same reference.
        inFlight.current = false;
        setFormError(NETWORK_ERROR_APPLICATION);
        failed();
        return;
      }
      if (result.ok) {
        // Reset BEFORE navigating (the route stays mounted, hidden, with cacheComponents).
        submissionId.current = null;
        resetAfterSuccess();
        inFlight.current = false;
        setSent(result.reference);
        router.push(applicationConfirmationHref(result.reference));
        return;
      }
      inFlight.current = false;
      applyServerErrors(result);
    });
  };

  const onInvalid = (errs: FieldErrors<ApplicationFormValues>) => {
    setFormError(null);
    const cvProblem = checkSelectedCv(cv);
    setCvError(cvProblem);
    setAnnouncement(problemsMessage(Math.max(1, countMessages(errs) + (cvProblem ? 1 : 0)), "application"));
    failed();
  };

  const problemsTitleId = fieldId("problems-title");
  const noticeId = fieldId("notice");

  return (
    <form
      ref={formRef}
      noValidate
      // Defence in depth, as on the contact forms: a click before hydration, or with JavaScript
      // off, must never put the applicant's details in the URL (a native GET would).
      method="post"
      onSubmit={(e) => {
        void form.handleSubmit(onValid, onInvalid)(e);
      }}
      aria-labelledby={labelledBy}
      className="relative"
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <p className="mb-8 border-l-4 border-charcoal bg-white p-5 text-sm leading-relaxed">
        {job ? (
          <>
            You are applying for <strong>{job.title}</strong>.{" "}
            <Link href={CAREERS_APPLY_PATH} className="text-bronze-text underline underline-offset-4">
              Send a general application instead
            </Link>
          </>
        ) : (
          <>This is a general application.</>
        )}
      </p>

      {sent ? (
        <p role="status" className="mb-8 border-l-4 border-olive-deep bg-white p-5 text-sm leading-relaxed">
          Your application has been sent. Your reference is <span className="font-mono">{sent}</span>.{" "}
          <Link href={applicationConfirmationHref(sent)} className="text-bronze-text underline underline-offset-4">
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
            {problems.length === 1
              ? "There is 1 problem with your application"
              : `There are ${problems.length} problems with your application`}
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
        <ApplicantFields
          fieldId={fieldId}
          register={register}
          errors={{
            fullName: errors.fullName?.message,
            email: errors.email?.message,
            phone: errors.phone?.message,
            country: errors.country?.message,
            message: errors.message?.message,
          }}
        />
        <CvField
          id={fieldId("cv")}
          inputRef={fileInput}
          fileName={cv?.name ?? null}
          error={cvError}
          onChange={(file) => {
            setCv(file);
            setCvError(null);
          }}
        />
      </div>

      <HoneypotField id={fieldId("website")} inputRef={honeypot} />

      <div className="mt-10 border-t border-charcoal pt-8">
        <ConsentField
          id={fieldId("consent")}
          error={errors.consent?.message}
          registration={register("consent")}
          label={careersConsentLabel}
        />
        <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-5">
          <button
            type="submit"
            disabled={isPending}
            aria-describedby={noticeId}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-charcoal px-8 py-3.5 text-sm font-medium tracking-wide text-ivory transition-colors hover:bg-bronze-text disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? "Sending your application\u{2026}" : "Send application"}
          </button>
          <CareersFormNotice id={noticeId} />
        </div>
        <p aria-live="polite" className="mt-4 text-xs text-muted-foreground">
          {isPending ? "Please wait, this can take a moment while your CV is uploaded." : "You will receive a reference number."}
        </p>
      </div>
    </form>
  );
}
