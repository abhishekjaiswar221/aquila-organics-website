import { addresses, company, contacts } from "@/content/site";
import type { Address } from "@/content/types";

function Office({ a }: { a: Address }) {
  return (
    <address className="not-italic">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-warm-grey">{a.label}</p>
      <p className="mt-2 text-sm leading-relaxed">
        {a.lines.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </p>
    </address>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto bg-charcoal text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="text-display-md">{company.shortName}</p>
          <p className="mt-3 max-w-xs text-sm text-warm-grey">{company.tagline}</p>
        </div>
        <div className="space-y-6">
          <Office a={addresses.headOffice} />
          <Office a={addresses.registeredOffice} />
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-warm-grey">Contact</p>
          <p>
            <a href={`mailto:${contacts.sales}`} className="underline underline-offset-4">
              {contacts.sales}
            </a>
          </p>
          <p>
            <a href={`mailto:${contacts.general}`} className="underline underline-offset-4">
              {contacts.general}
            </a>
          </p>
          <p>
            <a href={`tel:${contacts.phoneAromaChemicals.tel}`}>{contacts.phoneAromaChemicals.display}</a>
          </p>
          <p>
            <a href={`tel:${contacts.phoneFragrancesFlavours.tel}`}>{contacts.phoneFragrancesFlavours.display}</a>
          </p>
          <p className="text-warm-grey">{contacts.hours}</p>
        </div>
      </div>
      <div className="border-t border-ivory/15">
        <p className="mx-auto max-w-7xl px-6 py-5 text-xs text-warm-grey">
          © {company.name}
        </p>
      </div>
    </footer>
  );
}
