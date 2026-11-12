import { slugify } from "@/features/products/schema";

/*
 * Validation of the admin job-opening form (create and edit) and the one rule
 * that decides whether an opening is public. Pure: no database, no server-only,
 * so the admin form can import the constants. The server is the authority: only
 * the keys read below are looked at, so `status`, `publishedAt` and anything
 * else a client posts are ignored.
 */

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] as const;
export type EmploymentTypeValue = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_LABELS: Record<EmploymentTypeValue, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export const JOB_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export type JobStatusValue = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABELS: Record<JobStatusValue, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
};

export function isJobStatus(value: unknown): value is JobStatusValue {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

/** Slugs no opening may have: /careers/apply and /careers/apply/confirmation are routes. */
export const RESERVED_JOB_SLUGS: ReadonlySet<string> = new Set(["apply", "confirmation"]);

export const JOB_FIELDS = [
  "title",
  "slug",
  "location",
  "department",
  "employmentType",
  "summary",
  "description",
  "closesOn",
] as const;
export type JobField = (typeof JOB_FIELDS)[number];

export type JobFormData = {
  title: string;
  slug: string;
  location: string;
  department: string | null;
  employmentType: EmploymentTypeValue;
  summary: string;
  description: string;
  /** `YYYY-MM-DD`, a real calendar date, or null. */
  closesOn: string | null;
};

export type JobFormParse = { ok: true; data: JobFormData } | { ok: false; fieldErrors: Record<string, string> };

const clean = (value: FormDataEntryValue | null): string =>
  // Browsers submit multipart text with CRLF line breaks; the stored text uses LF, so
  // normalise here or an untouched multi-line field would look "changed" on every save.
  typeof value === "string" ? value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim() : "";

/** True for a `YYYY-MM-DD` string that is a real calendar date (2026-02-31 is not). */
export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseJobForm(formData: FormData): JobFormParse {
  const errors: Record<string, string> = {};
  const required = (key: string, max: number, label: string): string => {
    const value = clean(formData.get(key));
    if (value === "") errors[key] = `${label} is required`;
    else if (value.length > max) errors[key] = `${label} is too long (${max} characters at most)`;
    return value;
  };

  const title = required("title", 150, "Title");

  const rawSlug = clean(formData.get("slug"));
  const slug = slugify(rawSlug || title);
  if (!errors.title || rawSlug) {
    if (!slug) {
      if (rawSlug) errors.slug = "URL slug must contain letters or digits";
      else errors.title = "Title must contain letters or digits to build a URL slug";
    } else if (slug.length > 150) errors.slug = "URL slug is too long (150 characters at most)";
    else if (RESERVED_JOB_SLUGS.has(slug)) errors.slug = "That URL slug is reserved. Choose another.";
  }

  const location = required("location", 120, "Location");

  const rawDepartment = clean(formData.get("department"));
  let department: string | null = rawDepartment === "" ? null : rawDepartment;
  if (department !== null && department.length > 80) {
    errors.department = "Department is too long (80 characters at most)";
    department = null;
  }

  const rawType = clean(formData.get("employmentType"));
  const employmentType = (EMPLOYMENT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as EmploymentTypeValue)
    : null;
  if (!employmentType) errors.employmentType = "Choose an employment type from the list";

  const summary = required("summary", 300, "Summary");
  const description = required("description", 10_000, "Description");

  const rawCloses = clean(formData.get("closesOn"));
  let closesOn: string | null = null;
  if (rawCloses !== "") {
    if (isRealDate(rawCloses)) closesOn = rawCloses;
    else errors.closesOn = "Closing date must be a real date (YYYY-MM-DD)";
  }

  if (Object.keys(errors).length > 0 || !employmentType) return { ok: false, fieldErrors: errors };
  return { ok: true, data: { title, slug, location, department, employmentType, summary, description, closesOn } };
}

/** Names of the fields whose value differs between the stored opening and the submitted form. */
export function changedJobFields(before: JobFormData, after: JobFormData): JobField[] {
  return JOB_FIELDS.filter((field) => before[field] !== after[field]);
}

/** Shown when an opening was saved by someone else since the form loaded (not in the "use server" file: it may only export async functions). */
export const STALE_JOB_ERROR = "This opening was changed by someone else. Reload and try again.";

/** Fields that must be non-empty before an opening can be published. */
export function missingForPublish(job: { title: string; slug: string; location: string; summary: string; description: string }): string[] {
  const out: string[] = [];
  if (job.title.trim() === "") out.push("title");
  if (job.slug.trim() === "") out.push("slug");
  if (job.location.trim() === "") out.push("location");
  if (job.summary.trim() === "") out.push("summary");
  if (job.description.trim() === "") out.push("description");
  return out;
}

/** Midnight UTC at the start of `now`'s UTC day: the cut-off for `closesOn`. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The single rule for "visible to the public": status PUBLISHED, and `closesOn`
 * either unset or today (UTC) or later. Every public read goes through this.
 */
export function isJobPublic(job: { status: string; closesOn: Date | null }, now: Date): boolean {
  if (job.status !== "PUBLISHED") return false;
  return job.closesOn === null || job.closesOn.getTime() >= startOfUtcDay(now).getTime();
}
