import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ImageFrame } from "@/components/ui/image-frame";
import { consultationHref } from "@/content/segments";
import type { ApplicationRecord, SegmentRecord } from "@/content/types";
import { Breadcrumbs } from "./breadcrumbs";
import { PageSections } from "./page-sections";

/**
 * One application: the verified summary, optional extra sections (rendered only when they
 * exist), related applications as plain navigation, and a consultation link.
 */
export function ApplicationPage({ segment, application }: { segment: SegmentRecord; application: ApplicationRecord }) {
  const editorial = segment.id === "fragrances";
  const others = segment.applications.filter((a) => a.slug !== application.slug);
  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs
          trail={[
            { name: "Home", path: "/" },
            { name: segment.name, path: segment.path },
            { name: application.name, path: `${segment.path}/${application.slug}` },
          ]}
        />
      </div>

      <section className={editorial ? "" : "bg-cream"}>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-12 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-7">
            <Eyebrow>{segment.name}</Eyebrow>
            <h1 className={`${editorial ? "text-display-xl italic" : "text-display-xl"} mt-5`}>{application.name}</h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">{application.summary}</p>
            <div className="mt-10">
              <ActionButton href={consultationHref(segment.id, application.slug)} variant="primary">
                Request a consultation
              </ActionButton>
            </div>
          </div>
          <div className="lg:col-span-5">
            <ImageFrame
              ratio="4/5"
              alt={`${application.name} application imagery`}
              label={`${segment.id}: ${application.name} (supply or license)`}
            />
          </div>
        </div>
      </section>

      {application.blocks.length > 0 ? (
        <div className="mx-auto max-w-7xl px-6 pb-16 lg:pb-24">
          <PageSections blocks={application.blocks} />
        </div>
      ) : null}

      {others.length > 0 ? (
        <nav aria-label={`Other ${segment.name.toLowerCase()} applications`} className="border-t border-border">
          <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-3 px-6 py-8 text-sm">
            {others.map((a) => (
              <li key={a.slug}>
                <Link href={`${segment.path}/${a.slug}`} className="underline underline-offset-4">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
