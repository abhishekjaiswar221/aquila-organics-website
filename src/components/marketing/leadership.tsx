import { Eyebrow } from "@/components/ui/eyebrow";
import type { Block } from "@/content/types";

type Leader = { name: string; role: string; bio: string };

/** Plain, factual treatment. Portraits are added only once supplied and approved. */
export function Leadership({ leaders }: { leaders: Block<Leader>[] }) {
  if (leaders.length === 0) return null;
  return (
    <section id="leadership" aria-label="Leadership" className="border-t border-border bg-ivory">
      <div className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
        <Eyebrow>Leadership</Eyebrow>
        {leaders.map((l) => (
          <article key={l.id} className="mt-6">
            <h2 className="text-display-lg">{l.data.name}</h2>
            <p className="mt-2 font-mono text-sm text-bronze-text">{l.data.role}</p>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed">{l.data.bio}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
