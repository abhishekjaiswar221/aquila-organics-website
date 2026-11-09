import { Eyebrow } from "@/components/ui/eyebrow";
import type { IntroData } from "@/content/home";

export function Intro({ data }: { data: IntroData }) {
  return (
    <section aria-labelledby="intro-title" className="border-y border-border bg-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-5">
          <Eyebrow>About Aquila Organics</Eyebrow>
          <h2 id="intro-title" className="text-display-lg mt-4">
            A manufacturing partner for fragrance and flavour makers.
          </h2>
        </div>
        <div className="space-y-6 text-lg leading-relaxed lg:col-span-6 lg:col-start-7">
          {data.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <ul className="flex flex-wrap gap-2 pt-4" aria-label="Industries served">
            {data.industries.map((i) => (
              <li key={i} className="border border-charcoal/30 px-3 py-1 text-sm">
                {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
