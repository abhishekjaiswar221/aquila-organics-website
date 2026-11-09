import { SectionHeader } from "@/components/ui/section-header";

interface Props {
  data: { names: string[]; offer: string; process: string };
  toll?: string;
}

/** Technical treatment: mono labels on a ruled grid. */
export function AromaChemicals({ data, toll }: Props) {
  return (
    <section id="aroma-chemicals" aria-label="Aroma chemicals" className="border-y border-charcoal bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <SectionHeader eyebrow="Aroma chemicals" title="Chemistry that fragrance houses build on.">
          <p>{data.offer}</p>
        </SectionHeader>
        <ul className="mt-14 grid border-l border-t border-charcoal/30 sm:grid-cols-2 lg:grid-cols-4">
          {data.names.map((n, i) => (
            <li
              key={n}
              data-chemistry
              className="border-b border-r border-charcoal/30 p-5"
            >
              <span className="block font-mono text-[11px] text-bronze-text">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-2 block font-mono text-sm leading-snug">{n}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-muted-foreground">{data.process}</p>
        {toll ? <p className="mt-3 max-w-3xl text-muted-foreground">{toll}</p> : null}
      </div>
    </section>
  );
}
