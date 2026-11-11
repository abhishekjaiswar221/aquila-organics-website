import Link from "next/link";
import type { RefObject } from "react";
import type { UseFormRegister } from "react-hook-form";
import {
  FormField,
  controlCls,
  describedBy,
  errorCls,
  hintCls,
  inputCls,
  labelCls,
} from "@/components/forms/form-fields";
import { careersCvHint, careersFormNotice } from "@/content/careers";
import { visibleBlocks } from "@/content";
import { APPLICATION_MESSAGE_MAX } from "@/features/careers/application-schema";
import { CV_ACCEPT, type ApplicationFormValues } from "@/features/careers/form-state";
import { TEXT_LIMITS } from "@/features/enquiries/schema";
import { PRIVACY_PATH } from "@/lib/seo/site-url";
import { cn } from "@/lib/utils";

/*
 * Presentational pieces of the careers application form. Each form instance
 * keeps its own state, ids and submit logic (application-form.tsx).
 */

type FieldErrors = Partial<Record<"fullName" | "email" | "phone" | "country" | "message", string>>;

const LIMITS = TEXT_LIMITS;

/** Name, email, telephone, country and message. */
export function ApplicantFields({
  fieldId,
  register,
  errors,
}: {
  fieldId: (name: string) => string;
  register: UseFormRegister<ApplicationFormValues>;
  errors: FieldErrors;
}) {
  return (
    <>
      <FormField id={fieldId("fullName")} label="Full name" error={errors.fullName}>
        {(a11y) => (
          <input
            {...a11y}
            type="text"
            autoComplete="name"
            maxLength={LIMITS.fullName}
            className={inputCls}
            {...register("fullName")}
          />
        )}
      </FormField>
      <FormField id={fieldId("email")} label="Email" error={errors.email}>
        {(a11y) => (
          <input
            {...a11y}
            type="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={LIMITS.email}
            className={inputCls}
            {...register("email")}
          />
        )}
      </FormField>
      <FormField
        id={fieldId("phone")}
        label="Telephone (optional)"
        hint="Include the country code, for example +91."
        error={errors.phone}
      >
        {(a11y) => (
          <input
            {...a11y}
            type="tel"
            autoComplete="tel"
            maxLength={LIMITS.phone}
            className={inputCls}
            {...register("phone")}
          />
        )}
      </FormField>
      <FormField id={fieldId("country")} label="Country (optional)" error={errors.country}>
        {(a11y) => (
          <input
            {...a11y}
            type="text"
            autoComplete="country-name"
            maxLength={LIMITS.country}
            className={inputCls}
            {...register("country")}
          />
        )}
      </FormField>
      <FormField
        id={fieldId("message")}
        label="Message (optional)"
        hint={`Anything you would like the HR team to know. Up to ${APPLICATION_MESSAGE_MAX} characters.`}
        error={errors.message}
        className="md:col-span-2"
      >
        {(a11y) => (
          <textarea
            {...a11y}
            rows={6}
            maxLength={APPLICATION_MESSAGE_MAX}
            className={cn(controlCls, "py-3 leading-relaxed")}
            {...register("message")}
          />
        )}
      </FormField>
    </>
  );
}

/** The single CV file input, with its type and size hint and its error. */
export function CvField({
  id,
  inputRef,
  fileName,
  error,
  onChange,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  fileName: string | null;
  error: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="min-w-0 md:col-span-2">
      <label htmlFor={id} className={labelCls}>
        CV
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={CV_ACCEPT}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, error && `${id}-error`)}
        onChange={(e) => onChange(e.currentTarget.files?.[0] ?? null)}
        className="mt-2 block w-full min-w-0 text-sm text-muted-foreground file:mr-4 file:cursor-pointer file:rounded-sm file:border file:border-charcoal/40 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-charcoal hover:file:border-charcoal"
      />
      <p id={`${id}-hint`} className={hintCls}>
        {careersCvHint}.{fileName ? <span className="sr-only"> Selected: {fileName}.</span> : null}
      </p>
      {error ? (
        <p id={`${id}-error`} className={errorCls}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** What is collected, who sees it, retention and how to ask for deletion; sits beside the submit button. */
export function CareersFormNotice({ id }: { id: string }) {
  const [notice] = visibleBlocks([careersFormNotice]);
  if (!notice) return null;
  const { collected, access, retention, deletion } = notice.data;
  return (
    <div id={id} className="max-w-xl text-xs leading-relaxed text-muted-foreground">
      <p>
        {collected} {access} {retention}
      </p>
      <p className="mt-1.5">
        {deletion}{" "}
        <Link href={PRIVACY_PATH} className="text-bronze-text underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </div>
  );
}
