import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { JobCard } from "@/components/careers/job-card";
import { Breadcrumbs } from "@/components/pages/breadcrumbs";
import { JsonLd } from "@/components/pages/json-ld";
import { Eyebrow } from "@/components/ui/eyebrow";
import { visibleBlocks } from "@/content";
import { careersEmptyState, careersGeneralApplication, careersIntro, careersMeta } from "@/content/careers";
import { listPublishedJobs } from "@/features/careers/job-queries";
import { CAREERS_PATH, applyHref } from "@/features/careers/paths";
import { buildPageMetadata, pageBreadcrumbJsonLd, type Crumb } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

/*
 * Cache Components: the list is read per request (no `use cache`), so
 * publishing, closing or an opening's closing date applies at once. connection()
 * comes before `new Date()`; `instant = false` declares that blocking is intended.
 */
export const instant = false;

const TRAIL: Crumb[] = [
  { name: "Home", path: "/" },
  { name: careersMeta.title, path: CAREERS_PATH },
];

export function generateMetadata(): Metadata {
  return buildPageMetadata({ title: careersMeta.title, description: careersMeta.description, path: CAREERS_PATH });
}

const linkCls = "text-bronze-text underline underline-offset-4";

export default async function CareersPage() {
  await connection();
  const jobs = await listPublishedJobs(new Date());
  const [intro] = visibleBlocks([careersIntro]);
  const [empty] = visibleBlocks([careersEmptyState]);
  const [general] = visibleBlocks([careersGeneralApplication]);

  return (
    <>
      <JsonLd data={pageBreadcrumbJsonLd(TRAIL, SITE_URL)} />
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs trail={TRAIL} />
      </div>

      <section aria-labelledby="careers-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-12 lg:pb-16 lg:pt-20">
          <Eyebrow>Company / Careers</Eyebrow>
          <h1 id="careers-title" className="text-display-xl mt-5">
            {careersMeta.title}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{careersMeta.lead}</p>
          {intro ? <p className="mt-4 max-w-2xl text-base leading-relaxed">{intro.data}</p> : null}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        {jobs.length > 0 ? (
          <>
            <ul aria-label="Current openings" className="grid max-w-3xl gap-10">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </ul>
            <p className="mt-12 max-w-3xl border-t border-charcoal/20 pt-6 text-sm">
              <Link href={applyHref()} className={linkCls}>
                Send a general application
              </Link>
            </p>
          </>
        ) : (
          <section aria-labelledby="careers-empty-title" className="max-w-3xl border-t border-charcoal pt-6">
            <h2 id="careers-empty-title" className="text-2xl sm:text-3xl">
              {empty?.data}
            </h2>
            <p className="mt-4 text-base leading-relaxed">
              {general?.data}{" "}
              <Link href={applyHref()} className={linkCls}>
                Send a general application
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </>
  );
}
