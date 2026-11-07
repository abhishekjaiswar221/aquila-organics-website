import { contacts } from "@/content/site";

export function EnquiryCta({ data }: { data: { title: string; text: string } }) {
  return (
    <section id="enquire" aria-label="Business enquiry" className="bg-charcoal text-ivory">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <h2 className="text-display-lg max-w-3xl">{data.title}</h2>
        <p className="mt-5 max-w-xl text-warm-grey">{data.text}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href={`mailto:${contacts.sales}`}
            className="bg-ivory px-7 py-3.5 text-sm font-medium tracking-wide text-charcoal transition-colors hover:bg-bronze"
          >
            Email {contacts.sales}
          </a>
          <a
            href={`tel:${contacts.phoneAromaChemicals.tel}`}
            className="border border-ivory px-7 py-3.5 text-sm font-medium tracking-wide transition-colors hover:bg-ivory hover:text-charcoal"
          >
            Call {contacts.phoneAromaChemicals.display}
          </a>
        </div>
        <p className="mt-6 text-sm text-warm-grey">
          Fragrances and flavours:{" "}
          <a className="underline underline-offset-4" href={`tel:${contacts.phoneFragrancesFlavours.tel}`}>
            {contacts.phoneFragrancesFlavours.display}
          </a>
        </p>
      </div>
    </section>
  );
}
