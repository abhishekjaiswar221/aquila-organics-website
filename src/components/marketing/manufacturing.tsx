import { ImageFrame } from "@/components/ui/image-frame";
import { SectionHeader } from "@/components/ui/section-header";

interface Props {
  data: { intro: string; sites: { name: string; area: string }[] };
}

export function Manufacturing({ data }: Props) {
  return (
    <section id="manufacturing" aria-label="Manufacturing and R and D" className="bg-charcoal text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <SectionHeader eyebrow="Manufacturing" title="Made where we can stand behind it." className="[&_p]:text-warm-grey [&_p:first-child]:text-bronze">
            <p>{data.intro}</p>
          </SectionHeader>
          <dl className="mt-12 divide-y divide-ivory/20 border-y border-ivory/20">
            {data.sites.map((s) => (
              <div key={s.name} className="grid gap-1 py-5 sm:grid-cols-3">
                <dt className="font-mono text-xs uppercase tracking-[0.18em] text-bronze">{s.name}</dt>
                <dd className="sm:col-span-2">{s.area}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ImageFrame
          ratio="3/2"
          alt="Illustrative image of laboratory glassware"
          label="manufacturing: use ONLY real Aquila site photos, not stock"
        />
      </div>
    </section>
  );
}
