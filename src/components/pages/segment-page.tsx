import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { visibleBlocks } from "@/content";
import { consultationHref } from "@/content/segments";
import type { SegmentRecord } from "@/content/types";
import { Breadcrumbs } from "./breadcrumbs";
import { PageSections } from "./page-sections";

/** Segment overview: lead, a tile per application, segment-level notes and a consultation link. */
export function SegmentPage({ segment }: { segment: SegmentRecord }) {
  const lead = visibleBlocks([segment.lead])[0];
  const editorial = segment.id === "fragrances";
  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs trail={[{ name: "Home", path: "/" }, { name: segment.name, path: segment.path }]} />
      </div>
      <section className={editorial ? "" : "bg-cream"}>
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-12 lg:pb-24 lg:pt-20">
          <Eyebrow>Our business</Eyebrow>
          <h1 className={`${editorial ? "text-display-xl italic" : "text-display-xl"} mt-5`}>{segment.name}</h1>
          {lead ? <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lead.data}</p> : null}
        </div>
      </section>

      <section aria-labelledby="applications-title" className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <h2 id="applications-title" className="text-display-lg">
          Applications
        </h2>
        <ul className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {segment.applications.map((a, i) => (
            <li key={a.slug} className="border-t border-charcoal pt-6">
              <Link href={`${segment.path}/${a.slug}`} className="group block">
                <span className="font-mono text-xs text-bronze-text">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-2 flex items-start justify-between gap-4">
                  <h3 className="text-display-md">{a.name}</h3>
                  <ArrowUpRight
                    aria-hidden
                    className="mt-1 size-5 shrink-0 text-bronze-text transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </span>
                <p className="mt-3 text-muted-foreground">{a.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {segment.extras.length > 0 ? (
        <div className="mx-auto max-w-7xl px-6 pb-16">
          <PageSections blocks={segment.extras} />
        </div>
      ) : null}

      <section className="bg-charcoal text-ivory">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <p className="text-display-md max-w-2xl">Tell us what you are developing.</p>
          <div className="mt-8">
            <ActionButton href={consultationHref(segment.id)} variant="secondary" className="border-ivory text-ivory hover:bg-ivory hover:text-charcoal">
              Request a consultation
            </ActionButton>
          </div>
        </div>
      </section>
    </>
  );
}
