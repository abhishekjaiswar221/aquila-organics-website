import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationForm } from "@/components/careers/application-form";
import { Breadcrumbs } from "@/components/pages/breadcrumbs";
import { Eyebrow } from "@/components/ui/eyebrow";
import { visibleBlocks } from "@/content";
import { careersApplyIntro, careersApplyMeta, careersMeta } from "@/content/careers";
import { getPublishedJobBySlug } from "@/features/careers/job-queries";
import { CAREERS_APPLY_PATH, CAREERS_PATH, parseJobParam } from "@/features/careers/paths";
import { buildPageMetadata, type Crumb } from "@/lib/seo/page-metadata";

/*
 * Reads searchParams (the ?job= preselection) per request, so `instant = false`.
 * The slug is looked up with the same visibility rule as the public pages: an
 * unknown, draft, closed or expired opening is silently ignored and the visitor
 * sees the general application. Nothing from the URL is rendered except the
 * title of an opening that is public right now. The page is noindex.
 */
export const instant = false;

const TRAIL: Crumb[] = [
  { name: "Home", path: "/" },
  { name: careersMeta.title, path: CAREERS_PATH },
  { name: careersApplyMeta.title, path: CAREERS_APPLY_PATH },
];

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: careersApplyMeta.title,
    description: careersApplyMeta.description,
    path: CAREERS_APPLY_PATH,
    noindex: true,
  });
}

export default async function ApplyPage({ searchParams }: PageProps<"/careers/apply">) {
  const slug = parseJobParam((await searchParams).job);
  let job: { slug: string; title: string } | null = null;
  if (slug) {
    await connection();
    const found = await getPublishedJobBySlug(slug, new Date());
    if (found) job = { slug: found.slug, title: found.title };
  }
  const [intro] = visibleBlocks([careersApplyIntro]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs trail={TRAIL} />
      </div>

      <section aria-labelledby="apply-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-12 lg:pb-16 lg:pt-20">
          <Eyebrow>Careers / Apply</Eyebrow>
          <h1 id="apply-title" className="text-display-xl mt-5">
            {careersApplyMeta.title}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{careersApplyMeta.lead}</p>
          {intro ? <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro.data}</p> : null}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <ApplicationForm job={job} labelledBy="apply-title" />
      </div>
    </>
  );
}
