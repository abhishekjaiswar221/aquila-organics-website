import { ImageFrame } from "@/components/ui/image-frame";
import { SectionHeader } from "@/components/ui/section-header";
import type { Block } from "@/content/types";
import type { ApplicationData } from "@/content/home";

interface Props {
  intro: { heading: string; body: string } | undefined;
  applications: Block<ApplicationData>[];
  emphasis: { eyebrow: string; text: string } | undefined;
}

export function FragranceApplications({ intro, applications, emphasis }: Props) {
  if (applications.length === 0) return null;
  return (
    <section id="fragrances" aria-label="Fragrance applications"className="bg-ivory">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHeader eyebrow="Fragrances" title={intro?.heading ?? "Fragrances"} >
              {intro?.body}
            </SectionHeader>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <ImageFrame
              ratio="3/2"
              alt="Fragrance ingredients and perfumery materials"
              label="fragrance: botanical + oud materials"
            />
          </div>
        </div>

        <ol className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {applications.map((a, i) => (
            <li key={a.id} className="border-t border-charcoal pt-6">
              <span className="font-mono text-xs text-bronze-text">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-display-md mt-2">{a.data.name}</h3>
              <p className="mt-3 text-muted-foreground">{a.data.summary}</p>
            </li>
          ))}
        </ol>

        {emphasis ? (
          <aside className="mt-20 bg-charcoal px-8 py-12 text-ivory md:px-16">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-bronze">{emphasis.eyebrow}</p>
            <p className="text-display-md mt-4 max-w-3xl italic">{emphasis.text}</p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
