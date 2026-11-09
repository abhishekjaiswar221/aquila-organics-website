import { contacts } from "@/content/site";

/** Shown while nothing is published yet. No placeholder rows. */
export function CatalogueEmptyState() {
  return (
    <section aria-labelledby="catalogue-empty-title" className="border border-charcoal/30 bg-white p-8 sm:p-12">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Status: in preparation</p>
      <h2 id="catalogue-empty-title" className="text-display-md mt-4">
        Our online catalogue is being prepared.
      </h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        Product listings are verified before they are published here. In the meantime, our aroma chemicals
        team can answer questions about availability, specifications and documentation directly.
      </p>
      <dl className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</dt>
          <dd className="mt-1">
            <a href={`mailto:${contacts.sales}`} className="underline underline-offset-4">
              {contacts.sales}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Telephone</dt>
          <dd className="mt-1">
            <a href={`tel:${contacts.phoneAromaChemicals.tel}`} className="underline underline-offset-4">
              {contacts.phoneAromaChemicals.display}
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}
