"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { JobFormState } from "@/features/careers/job-actions";
import { EMPLOYMENT_LABELS, EMPLOYMENT_TYPES } from "@/features/careers/job-schema";
import type { JobEditModel } from "@/features/careers/job-queries";
import { cn } from "@/lib/utils";
import { buttonCls, inputCls, labelCls } from "./ui";

/*
 * One form for creating and editing a job opening. Fields are controlled so
 * React's post-action form reset cannot wipe what the user typed when the
 * server returns errors. Status is not part of the form: it changes only
 * through the Publish / Close buttons on the list.
 */

type Action = (prev: JobFormState, formData: FormData) => Promise<JobFormState>;
type Props = {
  action: Action;
  /** Present when editing. */
  job?: JobEditModel;
};

const textareaCls = cn(inputCls, "h-auto py-2 leading-relaxed");

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy || undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function JobForm({ action, job }: Props) {
  const editing = Boolean(job);
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const fieldErrorCount = Object.keys(errors).length;

  const [values, setValues] = useState({
    title: job?.title ?? "",
    slug: job?.slug ?? "",
    location: job?.location ?? "",
    department: job?.department ?? "",
    employmentType: job?.employmentType ?? "FULL_TIME",
    summary: job?.summary ?? "",
    description: job?.description ?? "",
    closesOn: job?.closesOn ?? "",
  });
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  return (
    <form action={formAction} noValidate className="mt-6 max-w-3xl space-y-6">
      {job ? (
        <>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="updatedAt" value={job.updatedAt} />
        </>
      ) : null}

      <div role="status" aria-live="polite" className="min-h-6 text-sm">
        {state ? (
          <p className={state.ok ? "font-medium text-olive-deep" : "font-medium text-destructive"}>
            {state.message}
            {!state.ok && fieldErrorCount > 0 ? ` (${fieldErrorCount} ${fieldErrorCount === 1 ? "field" : "fields"})` : ""}
          </p>
        ) : null}
      </div>

      <Field id="jf-title" label="Title" error={errors.title}>
        {(a) => (
          <input {...a} name="title" type="text" required aria-required value={values.title} onChange={set("title")} className={inputCls} autoComplete="off" />
        )}
      </Field>
      <Field
        id="jf-slug"
        label="URL slug"
        hint="Lower-case words joined by hyphens. Leave blank to build it from the title."
        error={errors.slug}
      >
        {(a) => <input {...a} name="slug" type="text" value={values.slug} onChange={set("slug")} className={cn(inputCls, "font-mono")} autoComplete="off" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="jf-location" label="Location" error={errors.location}>
          {(a) => (
            <input {...a} name="location" type="text" required aria-required value={values.location} onChange={set("location")} className={inputCls} autoComplete="off" />
          )}
        </Field>
        <Field id="jf-department" label="Department" hint="Optional." error={errors.department}>
          {(a) => <input {...a} name="department" type="text" value={values.department} onChange={set("department")} className={inputCls} autoComplete="off" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="jf-type" label="Employment type" error={errors.employmentType}>
          {(a) => (
            <select {...a} name="employmentType" value={values.employmentType} onChange={set("employmentType")} className={inputCls}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          id="jf-closes"
          label="Closing date"
          hint="Optional. The opening disappears from the public site after this date."
          error={errors.closesOn}
        >
          {(a) => <input {...a} name="closesOn" type="date" value={values.closesOn} onChange={set("closesOn")} className={inputCls} />}
        </Field>
      </div>
      <Field
        id="jf-summary"
        label="Summary"
        hint="One or two sentences, up to 300 characters. Shown on the list and used as the page description."
        error={errors.summary}
      >
        {(a) => (
          <textarea {...a} name="summary" rows={3} required aria-required value={values.summary} onChange={set("summary")} className={textareaCls} />
        )}
      </Field>
      <Field
        id="jf-description"
        label="Description"
        hint="Plain text. A blank line starts a new paragraph. No formatting is interpreted."
        error={errors.description}
      >
        {(a) => (
          <textarea {...a} name="description" rows={12} required aria-required value={values.description} onChange={set("description")} className={textareaCls} />
        )}
      </Field>

      <div>
        <button type="submit" disabled={pending} className={buttonCls}>
          {pending ? "Saving..." : editing ? "Save changes" : "Create opening"}
        </button>
        {!editing ? (
          <p className="mt-2 text-xs text-muted-foreground">
            New openings start as drafts. Publish one from the list when it is ready.
          </p>
        ) : null}
      </div>
    </form>
  );
}
