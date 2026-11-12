import { company } from "@/content/site";
import type { PublishedJob } from "@/features/careers/job-queries";
import { jobPath } from "@/features/careers/paths";
import { absoluteUrl } from "@/lib/seo/site-url";

/** schema.org values for our employment types. */
const EMPLOYMENT_TYPE_LD = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  INTERNSHIP: "INTERN",
} as const;

/**
 * schema.org JobPosting for a PUBLIC opening (the caller passes only what
 * getPublishedJobBySlug returned). Returns null unless title, description,
 * publishedAt and location are all present: Google rejects partial postings,
 * and nothing is made up to fill a gap. `validThrough` appears only when the
 * opening has a closing date. The hiring organisation is the site's company
 * name. No salary, benefit, remote-work or other field is ever emitted.
 * Serialise with serializeJsonLd (the JsonLd component), which escapes `<`.
 */
export function jobPostingJsonLd(job: PublishedJob, baseUrl: string): object | null {
  const title = job.title?.trim();
  const description = job.description?.trim();
  const location = job.location?.trim();
  if (!title || !description || !location || !job.publishedAt) return null;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    datePosted: job.publishedAt.toISOString(),
    // The site shows an opening through the end of its closing day (UTC), so the structured data says the same
    // instead of a bare date that consumers may read as the start of that day.
    ...(job.closesOn ? { validThrough: `${job.closesOn.toISOString().slice(0, 10)}T23:59:59Z` } : {}),
    employmentType: EMPLOYMENT_TYPE_LD[job.employmentType],
    url: absoluteUrl(baseUrl, jobPath(job.slug)),
    hiringOrganization: { "@type": "Organization", name: company.name, sameAs: baseUrl },
    jobLocation: { "@type": "Place", address: location },
  };
}
