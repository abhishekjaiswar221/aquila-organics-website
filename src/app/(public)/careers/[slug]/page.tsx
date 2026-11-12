import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { Breadcrumbs } from "@/components/pages/breadcrumbs";
import { JsonLd } from "@/components/pages/json-ld";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getPublishedJobBySlug } from "@/features/careers/job-queries";
import { EMPLOYMENT_LABELS } from "@/features/careers/job-schema";
import { jobPostingJsonLd } from "@/features/careers/jsonld";
import { CAREERS_PATH, applyHref, jobPath } from "@/features/careers/paths";
import { buildPageMetadata, pageBreadcrumbJsonLd, type Crumb } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

/*
 * Cache Components: rendered per request with no `use cache`, so closing an
 * opening applies at once. Unpublished, closed, expired and unknown slugs get
 * their 404 status from src/proxy.ts before rendering; the notFound() below is
 * the in-render fallback. connection() precedes `new Date()`.
 */
export const instant = false;

// One query per request, shared by generateMetadata and the page.
const loadJob = cache(async (slug: string) => {
  await connection();
  return getPublishedJobBySlug(slug, new Date());
});

export async function generateMetadata({ params }: PageProps<"/careers/[slug]">): Promise<Metadata> {
  const slug = (await params).slug;
  const job = await loadJob(slug);
  if (!job) return { title: "Opening not found", robots: { index: false, follow: true } };
  return buildPageMetadata({ title: job.title, description: job.summary, path: jobPath(job.slug) });
}

/** Plain text: blank lines separate paragraphs; nothing is interpreted as markup. */
function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export default async function JobPage({ params }: PageProps<"/careers/[slug]">) {
  const job = await loadJob((await params).slug);
  if (!job) notFound();

  const trail: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Careers", path: CAREERS_PATH },
    { name: job.title, path: jobPath(job.slug) },
  ];
  const posting = jobPostingJsonLd(job, SITE_URL);

  return (
    <article>
      {posting ? <JsonLd data={posting} /> : null}
      <JsonLd data={pageBreadcrumbJsonLd(trail, SITE_URL)} />
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs trail={trail} />
      </div>

      <section aria-labelledby="job-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-12 lg:pb-16 lg:pt-20">
          <Eyebrow>Careers / Opening</Eyebrow>
          <h1 id="job-title" className="text-display-lg mt-5 max-w-4xl">
            {job.title}
          </h1>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Location</dt>
              <dd className="mt-1">{job.location}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Type</dt>
              <dd className="mt-1">{EMPLOYMENT_LABELS[job.employmentType]}</dd>
            </div>
            {job.department ? (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Department</dt>
                <dd className="mt-1">{job.department}</dd>
              </div>
            ) : null}
            {job.closesOn ? (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Apply by</dt>
                <dd className="mt-1">
                  <time dateTime={job.closesOn.toISOString().slice(0, 10)}>
                    {job.closesOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-8">
            <Link
              href={applyHref(job.slug)}
              className="inline-flex min-h-12 items-center justify-center rounded-sm bg-charcoal px-8 py-3.5 text-sm font-medium tracking-wide text-ivory transition-colors hover:bg-bronze-text"
            >
              Apply for this opening
            </Link>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <p className="text-lg leading-relaxed text-muted-foreground">{job.summary}</p>
        <div className="mt-8 space-y-5 text-base leading-relaxed">
          {paragraphs(job.description).map((p, i) => (
            <p key={i} className="whitespace-pre-line wrap-break-word">
              {p}
            </p>
          ))}
        </div>
        <p className="mt-12 border-t border-charcoal/20 pt-6 text-sm">
          <Link href={CAREERS_PATH} className="text-bronze-text underline underline-offset-4">
            Back to all openings
          </Link>
        </p>
      </div>
    </article>
  );
}
