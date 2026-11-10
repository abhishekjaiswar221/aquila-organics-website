"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { ProductEditState } from "@/features/products/edit-actions";
import type { CategoryOption, ProductEditModel } from "@/features/products/edit-queries";
import { cn } from "@/lib/utils";
import { SectionTitle, buttonCls, inputCls, labelCls, secondaryButtonCls } from "./ui";

/*
 * One form for creating and editing a product. Fields are controlled so React's
 * post-action form reset cannot wipe what the user typed when the server
 * returns errors. Posted shape: see src/features/products/form-schema.ts
 * (spec-label-N / spec-value-N / application-N, N = row position). Submitting
 * works through the Server Action even before hydration.
 */

type Action = (prev: ProductEditState, formData: FormData) => Promise<ProductEditState>;
type Props = {
  action: Action;
  categories: CategoryOption[];
  /** Present when editing. */
  product?: ProductEditModel;
};

const UNPUBLISH_WARNING = "Saving changes to a published product will unpublish it until it is verified again.";
const textareaCls = cn(inputCls, "h-auto py-2 leading-relaxed");

type Row = { key: number; label: string; value: string };
type AppRow = { key: number; value: string };

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

export function ProductForm({ action, categories, product }: Props) {
  const editing = Boolean(product);
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};

  const [values, setValues] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    code: product?.code ?? "",
    casNumber: product?.casNumber ?? "",
    categoryId: product?.categoryId ?? "",
    description: product?.description ?? "",
    seoTitle: product?.seoTitle ?? "",
    seoDescription: product?.seoDescription ?? "",
    sourceNote: product?.sourceNote ?? "",
  });
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  // Row keys are stable ids for React and the DOM; the posted names use the row position.
  const [specs, setSpecs] = useState<Row[]>(() => (product?.specifications ?? []).map((s, key) => ({ key, ...s })));
  const [apps, setApps] = useState<AppRow[]>(() => (product?.applications ?? []).map((value, key) => ({ key, value })));

  // After adding a row, move focus into it; after removing one, to the add button.
  const focusAfterRender = useRef<string | null>(null);
  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });
  const nextKey = (rows: { key: number }[]) => rows.reduce((max, r) => Math.max(max, r.key), -1) + 1;

  const addSpec = () => {
    const key = nextKey(specs);
    setSpecs((rows) => [...rows, { key, label: "", value: "" }]);
    focusAfterRender.current = `spec-label-field-${key}`;
  };
  const addApp = () => {
    const key = nextKey(apps);
    setApps((rows) => [...rows, { key, value: "" }]);
    focusAfterRender.current = `application-field-${key}`;
  };

  const published = product?.status === "PUBLISHED";
  const fieldErrorCount = Object.keys(errors).length;

  return (
    <form action={formAction} noValidate className="mt-6 max-w-3xl space-y-8">
      {product ? (
        <>
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="updatedAt" value={product.updatedAt} />
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

      <section aria-labelledby="pf-basics" className="space-y-4">
        <SectionTitle id="pf-basics">Basics</SectionTitle>
        <Field id="pf-name" label="Name" error={errors.name}>
          {(a) => (
            <input {...a} name="name" type="text" required aria-required value={values.name} onChange={set("name")} className={inputCls} autoComplete="off" />
          )}
        </Field>
        <Field
          id="pf-slug"
          label="URL slug"
          hint="Lower-case words joined by hyphens. Leave blank to build it from the name."
          error={errors.slug}
        >
          {(a) => <input {...a} name="slug" type="text" value={values.slug} onChange={set("slug")} className={cn(inputCls, "font-mono")} autoComplete="off" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pf-code" label="Code" hint="Optional. Must be unique." error={errors.code}>
            {(a) => <input {...a} name="code" type="text" value={values.code} onChange={set("code")} className={cn(inputCls, "font-mono")} autoComplete="off" />}
          </Field>
          <Field id="pf-cas" label="CAS number" hint="Optional, for example 64-17-5." error={errors.casNumber}>
            {(a) => <input {...a} name="casNumber" type="text" value={values.casNumber} onChange={set("casNumber")} className={cn(inputCls, "font-mono")} autoComplete="off" />}
          </Field>
        </div>
        <Field id="pf-category" label="Category" error={errors.categoryId}>
          {(a) => (
            <select {...a} name="categoryId" value={values.categoryId} onChange={set("categoryId")} className={inputCls}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>

      <section aria-labelledby="pf-content" className="space-y-4">
        <SectionTitle id="pf-content">Content and search</SectionTitle>
        <Field id="pf-description" label="Description" error={errors.description}>
          {(a) => <textarea {...a} name="description" rows={6} value={values.description} onChange={set("description")} className={textareaCls} />}
        </Field>
        <Field id="pf-seo-title" label="SEO title" error={errors.seoTitle}>
          {(a) => <input {...a} name="seoTitle" type="text" value={values.seoTitle} onChange={set("seoTitle")} className={inputCls} autoComplete="off" />}
        </Field>
        <Field id="pf-seo-description" label="SEO description" error={errors.seoDescription}>
          {(a) => <textarea {...a} name="seoDescription" rows={3} value={values.seoDescription} onChange={set("seoDescription")} className={textareaCls} />}
        </Field>
      </section>

      <section aria-labelledby="pf-specs" className="space-y-3">
        <SectionTitle id="pf-specs">Specifications</SectionTitle>
        {errors.specifications ? (
          <p id="pf-specs-error" className="text-sm font-medium text-destructive">
            {errors.specifications}
          </p>
        ) : null}
        <ul aria-labelledby="pf-specs" aria-describedby={errors.specifications ? "pf-specs-error" : undefined} className="space-y-3">
          {specs.map((row, i) => (
            <li key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <label htmlFor={`spec-label-field-${row.key}`} className={labelCls}>
                  Label {i + 1}
                </label>
                <input
                  id={`spec-label-field-${row.key}`}
                  name={`spec-label-${i}`}
                  type="text"
                  value={row.label}
                  onChange={(e) => setSpecs((rows) => rows.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)))}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor={`spec-value-field-${row.key}`} className={labelCls}>
                  Value {i + 1}
                </label>
                <input
                  id={`spec-value-field-${row.key}`}
                  name={`spec-value-${i}`}
                  type="text"
                  value={row.value}
                  onChange={(e) => setSpecs((rows) => rows.map((r) => (r.key === row.key ? { ...r, value: e.target.value } : r)))}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className={secondaryButtonCls}
                onClick={() => {
                  setSpecs((rows) => rows.filter((r) => r.key !== row.key));
                  focusAfterRender.current = "pf-add-spec";
                }}
              >
                Remove<span className="sr-only"> specification {i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
        <button id="pf-add-spec" type="button" className={secondaryButtonCls} onClick={addSpec}>
          Add specification
        </button>
      </section>

      <section aria-labelledby="pf-apps" className="space-y-3">
        <SectionTitle id="pf-apps">Applications</SectionTitle>
        {errors.applications ? (
          <p id="pf-apps-error" className="text-sm font-medium text-destructive">
            {errors.applications}
          </p>
        ) : null}
        <ul aria-labelledby="pf-apps" aria-describedby={errors.applications ? "pf-apps-error" : undefined} className="space-y-3">
          {apps.map((row, i) => (
            <li key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <label htmlFor={`application-field-${row.key}`} className={labelCls}>
                  Application {i + 1}
                </label>
                <input
                  id={`application-field-${row.key}`}
                  name={`application-${i}`}
                  type="text"
                  value={row.value}
                  onChange={(e) => setApps((rows) => rows.map((r) => (r.key === row.key ? { ...r, value: e.target.value } : r)))}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className={secondaryButtonCls}
                onClick={() => {
                  setApps((rows) => rows.filter((r) => r.key !== row.key));
                  focusAfterRender.current = "pf-add-app";
                }}
              >
                Remove<span className="sr-only"> application {i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
        <button id="pf-add-app" type="button" className={secondaryButtonCls} onClick={addApp}>
          Add application
        </button>
      </section>

      <section aria-labelledby="pf-internal" className="space-y-4">
        <SectionTitle id="pf-internal">Internal</SectionTitle>
        <Field
          id="pf-source-note"
          label="Source note"
          hint="Not shown publicly. Changing only this note does not unpublish a published product."
          error={errors.sourceNote}
        >
          {(a) => <textarea {...a} name="sourceNote" rows={3} value={values.sourceNote} onChange={set("sourceNote")} className={textareaCls} />}
        </Field>
      </section>

      {published ? (
        <p className="border border-bronze-text bg-cream p-3 text-sm font-medium">{UNPUBLISH_WARNING}</p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={buttonCls}>
          {pending ? "Saving..." : editing ? "Save changes" : "Create product"}
        </button>
        {!editing ? (
          <p className="mt-2 text-xs text-muted-foreground">
            New products start as drafts. A super admin verifies them before they can be published.
          </p>
        ) : null}
      </div>
    </form>
  );
}
