import { SectionHeader } from "@/components/ui/section-header";

interface Props {
  data: { lead: string; items: { title: string; text: string }[] };
}

/** Plain editorial treatment: no badges, no metrics we cannot source. */
export function Sustainability({ data }: Props) {
  return (
    <section id="sustainability" aria-label="Sustainability" className="bg-olive-deep text-white">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <SectionHeader eyebrow="Sustainability" title="Responsible by process, not by label." className="[&_p]:text-white [&_p:first-child]:text-white">
          <p>{data.lead}</p>
        </SectionHeader>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {data.items.map((i) => (
            <div key={i.title} className="border-t border-white/60 pt-5">
              <h3 className="text-display-md">{i.title}</h3>
              <p className="mt-3 text-sm leading-relaxed">{i.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
