import { ImageFrame } from "@/components/ui/image-frame";
import { SectionHeader } from "@/components/ui/section-header";
import type { FlavourApp } from "@/content/home-business";
import type { Block } from "@/content/types";

interface Props {
  lead?: string;
  applications: Block<FlavourApp>[];
  extra?: string;
}

/** Warm, photographic treatment. */
export function Flavours({ lead, applications, extra }: Props) {
  if (applications.length === 0) return null;
  return (
    <section id="flavours" aria-label="Flavours" className="bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <SectionHeader eyebrow="Flavours" title="Taste, developed with the same care.">
          {lead}
        </SectionHeader>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {applications.map((a, i) => (
            <article key={a.id} className={i % 2 ? "lg:mt-10" : ""}>
              <ImageFrame ratio="4/5" alt={`${a.data.name} flavour application`} label={`flavours: ${a.data.name.toLowerCase()}`} />
              <h3 className="text-display-md mt-4">{a.data.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.data.summary}</p>
            </article>
          ))}
        </div>
        {extra ? <p className="mt-10 text-muted-foreground">{extra}</p> : null}
      </div>
    </section>
  );
}
