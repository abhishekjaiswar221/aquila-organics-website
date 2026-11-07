import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { Block } from "@/content/types";
import type { SegmentData } from "@/content/home";

/** Three segments, three different treatments: editorial, technical, warm. */
export function Segments({ blocks }: { blocks: Block<SegmentData>[] }) {
  if (blocks.length === 0) return null;
  const by = (id: SegmentData["id"]) => blocks.find((b) => b.data.id === id)?.data;
  const fr = by("fragrances");
  const ac = by("aroma-chemicals");
  const fl = by("flavours");

  return (
    <section id="segments" aria-labelledby="segments-title" className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
      <Eyebrow>Three business segments</Eyebrow>
      <h2 id="segments-title" className="sr-only">
        What Aquila makes
      </h2>
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {fr ? (
          <Link
            href={fr.href}
            className="group flex min-h-[26rem] flex-col justify-between bg-charcoal p-10 text-ivory lg:col-span-6"
          >
            <ArrowUpRight aria-hidden className="size-6 self-end text-bronze transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            <div>
              <h3 className="text-display-lg italic">{fr.title}</h3>
              <p className="mt-4 max-w-md text-warm-grey">{fr.summary}</p>
            </div>
          </Link>
        ) : null}
        {ac ? (
          <Link
            href={ac.href}
            className="group flex min-h-[26rem] flex-col justify-between border border-charcoal p-10 lg:col-span-3"
          >
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Ingredients</p>
            <div>
              <h3 className="text-display-md">{ac.title}</h3>
              <p className="mt-4 text-sm text-muted-foreground">{ac.summary}</p>
              <span className="mt-6 inline-block text-sm underline underline-offset-4 decoration-1 group-hover:decoration-2">
                View capabilities
              </span>
            </div>
          </Link>
        ) : null}
        {fl ? (
          <Link
            href={fl.href}
            className="group flex min-h-[26rem] flex-col justify-between bg-cream p-10 lg:col-span-3"
          >
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Now expanding</p>
            <div>
              <h3 className="text-display-md">{fl.title}</h3>
              <p className="mt-4 text-sm text-muted-foreground">{fl.summary}</p>
              <span className="mt-6 inline-block text-sm underline underline-offset-4 decoration-1 group-hover:decoration-2">
                View applications
              </span>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
