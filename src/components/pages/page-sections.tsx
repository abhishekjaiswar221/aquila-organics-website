import { visibleBlocks } from "@/content";
import type { Block, PageSection } from "@/content/types";

function Section({ section }: { section: PageSection }) {
  if (section.kind === "paragraphs") {
    return (
      <div>
        {section.heading ? <h2 className="text-display-md">{section.heading}</h2> : null}
        <div className={`${section.heading ? "mt-4 " : ""}max-w-2xl space-y-5 text-lg leading-relaxed`}>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    );
  }
  if (section.kind === "list") {
    return (
      <div>
        <h2 className="text-display-md">{section.heading}</h2>
        <ul className="mt-6 grid border-t border-charcoal/30 sm:grid-cols-2">
          {section.items.map((item) => (
            <li key={item} className="border-b border-charcoal/30 py-3 pr-6">
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <aside className="bg-charcoal px-8 py-12 text-ivory md:px-16">
      {section.eyebrow ? (
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-bronze">{section.eyebrow}</p>
      ) : null}
      <p className="text-display-md mt-4 max-w-3xl italic">{section.text}</p>
    </aside>
  );
}

/** Renders content sections, skipping any block marked hidden. Renders nothing when empty. */
export function PageSections({ blocks }: { blocks: Block<PageSection>[] }) {
  const visible = visibleBlocks(blocks);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-14">
      {visible.map((b) => (
        <Section key={b.id} section={b.data} />
      ))}
    </div>
  );
}
