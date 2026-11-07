import { Eyebrow } from "@/components/ui/eyebrow";

export function GlobalReach({ data }: { data: { lead: string; regions: string[] } }) {
  return (
    <section id="global-reach" aria-label="Global reach" className="bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <Eyebrow>Global reach</Eyebrow>
        <p className="text-display-md mt-3 max-w-2xl">{data.lead}</p>
        <ul className="mt-10 flex flex-wrap gap-x-12 gap-y-4">
          {data.regions.map((r) => (
            <li key={r} className="text-display-lg">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
