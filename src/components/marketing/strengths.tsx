import { SectionHeader } from "@/components/ui/section-header";

export function Strengths({ items }: { items: { title: string; text: string }[] }) {
  return (
    <section id="strengths" aria-label="Company strengths" className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
      <SectionHeader eyebrow="Why Aquila" title="Built around the way our customers work." />
      <ul className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {items.map((s) => (
          <li key={s.title} className="flex gap-6 border-t border-charcoal pt-6">
            <div>
              <h3 className="text-display-md">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
