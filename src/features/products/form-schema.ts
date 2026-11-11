import { isValidCas, normalizeCas } from "@/lib/cas";
import { normalizeUuid } from "@/lib/uuid";
import { isReservedSlug, slugify } from "./schema";

/*
 * Validation of the admin product form (create and edit). The server is the
 * authority: only the keys read below are looked at, so `status`, `verified`,
 * `casNormalized`, `publishedAt` and anything else a client posts are ignored.
 *
 * Form encoding (plain multipart fields, so it also works without JavaScript):
 *   name, slug, code, casNumber, categoryId, description, seoTitle,
 *   seoDescription, sourceNote
 *   spec-label-N / spec-value-N   specification row N (N = 0, 1, 2 ...; rows are
 *                                 ordered by N, a row with both parts blank is skipped)
 *   application-N                 application name N (blank skipped, repeats removed)
 */

export const MAX_SPECIFICATIONS = 100;
export const MAX_APPLICATIONS = 100;
// Distinct row indexes read at all; protects against a request with thousands of keys.
const MAX_ROW_INDEXES = 500;

export const PRODUCT_FIELDS = [
  "name",
  "slug",
  "code",
  "casNumber",
  "categoryId",
  "description",
  "seoTitle",
  "seoDescription",
  "sourceNote",
  "specifications",
  "applications",
] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];

/** Fields shown on the public product page: everything except the internal source note. */
export const PUBLIC_PRODUCT_FIELDS: readonly ProductField[] = PRODUCT_FIELDS.filter((f) => f !== "sourceNote");

export type ProductFormData = {
  name: string;
  slug: string;
  code: string | null;
  casNumber: string | null;
  /** Digits of casNumber; always derived here, never read from the form. */
  casNormalized: string | null;
  categoryId: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sourceNote: string | null;
  specifications: { label: string; value: string }[];
  applications: string[];
};

export type ProductFormParse =
  | { ok: true; data: ProductFormData }
  | { ok: false; fieldErrors: Record<string, string> };

const clean = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";

function rowIndexes(formData: FormData, pattern: RegExp): number[] | null {
  const seen = new Set<number>();
  for (const key of formData.keys()) {
    const match = pattern.exec(key);
    if (!match) continue;
    seen.add(Number(match[1]));
    if (seen.size > MAX_ROW_INDEXES) return null;
  }
  return [...seen].sort((a, b) => a - b);
}

export function parseProductForm(formData: FormData): ProductFormParse {
  const errors: Record<string, string> = {};
  const text = (key: string, max: number, label: string): string | null => {
    const value = clean(formData.get(key));
    if (value === "") return null;
    if (value.length > max) {
      errors[key] = `${label} is too long (${max} characters at most)`;
      return null;
    }
    return value;
  };

  const name = clean(formData.get("name"));
  if (name === "") errors.name = "Name is required";
  else if (name.length > 200) errors.name = "Name is too long (200 characters at most)";

  const rawSlug = clean(formData.get("slug"));
  const slug = slugify(rawSlug || name);
  if (!errors.name) {
    if (!slug) {
      if (rawSlug) errors.slug = "URL slug must contain letters or digits";
      else errors.name = "Name must contain letters or digits to build a URL slug";
    } else if (slug.length > 200) errors.slug = "URL slug is too long (200 characters at most)";
    else if (isReservedSlug(slug)) errors.slug = "That URL slug is reserved. Choose another.";
  }

  const code = text("code", 100, "Code");

  const casNumber = text("casNumber", 20, "CAS number");
  let casNormalized: string | null = null;
  if (casNumber !== null && !errors.casNumber) {
    if (isValidCas(casNumber)) casNormalized = normalizeCas(casNumber);
    else errors.casNumber = "Invalid CAS number (check the format and check digit)";
  }

  const rawCategory = clean(formData.get("categoryId"));
  const categoryId = rawCategory === "" ? null : normalizeUuid(rawCategory);
  if (rawCategory !== "" && !categoryId) errors.categoryId = "Choose a category from the list";

  const description = text("description", 10_000, "Description");
  const seoTitle = text("seoTitle", 200, "SEO title");
  const seoDescription = text("seoDescription", 500, "SEO description");
  const sourceNote = text("sourceNote", 2000, "Source note");

  const specifications: { label: string; value: string }[] = [];
  const specIndexes = rowIndexes(formData, /^spec-(?:label|value)-(\d{1,4})$/);
  if (!specIndexes) errors.specifications = `At most ${MAX_SPECIFICATIONS} specification rows`;
  else {
    for (const n of specIndexes) {
      const label = clean(formData.get(`spec-label-${n}`));
      const value = clean(formData.get(`spec-value-${n}`));
      if (label === "" && value === "") continue;
      const row = specifications.length + 1;
      if (label === "") errors.specifications ??= `Specification ${row} needs a label`;
      else if (value === "") errors.specifications ??= `Specification ${row} needs a value`;
      else if (label.length > 200) errors.specifications ??= `Specification ${row}: label is too long (200 characters at most)`;
      else if (value.length > 1000) errors.specifications ??= `Specification ${row}: value is too long (1000 characters at most)`;
      specifications.push({ label, value });
    }
    if (specifications.length > MAX_SPECIFICATIONS) {
      errors.specifications = `At most ${MAX_SPECIFICATIONS} specification rows`;
    }
  }

  const applications: string[] = [];
  const appIndexes = rowIndexes(formData, /^application-(\d{1,4})$/);
  if (!appIndexes) errors.applications = `At most ${MAX_APPLICATIONS} applications`;
  else {
    const seen = new Set<string>();
    for (const n of appIndexes) {
      const value = clean(formData.get(`application-${n}`));
      if (value === "" || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      if (value.length > 200) errors.applications ??= "Each application is 200 characters at most";
      applications.push(value);
    }
    if (applications.length > MAX_APPLICATIONS) errors.applications = `At most ${MAX_APPLICATIONS} applications`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: {
      name,
      slug,
      code,
      casNumber,
      casNormalized,
      categoryId,
      description,
      seoTitle,
      seoDescription,
      sourceNote,
      specifications,
      applications,
    },
  };
}

export type ProductSnapshot = Omit<ProductFormData, "casNormalized">;

/** Names of the fields whose value differs between the stored product and the submitted form. */
export function changedProductFields(before: ProductSnapshot, after: ProductSnapshot): ProductField[] {
  return PRODUCT_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

/** Shown when a product was saved by someone else since the form loaded (not in the "use server" file: it may only export async functions). */
export const STALE_PRODUCT_ERROR = "This product was changed by someone else. Reload and try again.";
