import type { Metadata } from "next";
import { RfqForm } from "@/components/forms/rfq-form";
import { Eyebrow } from "@/components/ui/eyebrow";
import { contacts } from "@/content/site";

export const metadata: Metadata = {
  title: "Request a quotation",
  description:
    "Send Aquila Organics one request for quotation covering several aroma chemicals, fragrances or flavours, with quantities and any specification documents.",
  alternates: { canonical: "/rfq" },
};

/*
 * Static page: the saved product list lives in the visitor's browser, so the
 * client form reads it after hydration and loads published product details
 * through the getEnquiryProducts server action. No request data is read here.
 */
export default function RfqPage() {
  return (
    <>
      <section aria-labelledby="rfq-title" className="border-b border-charcoal/20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-12 pt-14 lg:grid-cols-12 lg:pb-16 lg:pt-20">
          <div className="lg:col-span-8">
            <Eyebrow>Enquiry / Request for quotation</Eyebrow>
            <h1 id="rfq-title" className="text-display-lg mt-4">
              Request a quotation
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              List the products and quantities you need, tell us a little about your company and application, and
              attach any specification. One enquiry can cover several products.
            </p>
          </div>
          <p className="self-end font-mono text-xs uppercase leading-relaxed tracking-[0.16em] text-muted-foreground lg:col-span-4 lg:text-right">
            All fields are required
            <br />
            unless marked optional.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-12 lg:grid-cols-12 lg:gap-12 lg:py-16">
        <div className="min-w-0 lg:col-span-8">
          <RfqForm />
        </div>
        <aside aria-labelledby="rfq-help-title" className="min-w-0 lg:col-span-4">
          <div className="border-t border-charcoal pt-6 lg:sticky lg:top-40">
            <h2 id="rfq-help-title" className="text-2xl">
              Prefer to talk to us?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              You can also send an enquiry by email or speak to the team during office hours.
            </p>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sales</dt>
                <dd className="mt-1">
                  <a href={`mailto:${contacts.sales}`} className="underline underline-offset-4 hover:text-bronze-text">
                    {contacts.sales}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Aroma chemicals
                </dt>
                <dd className="mt-1">
                  <a href={`tel:${contacts.phoneAromaChemicals.tel}`} className="hover:text-bronze-text">
                    {contacts.phoneAromaChemicals.display}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Fragrances and flavours
                </dt>
                <dd className="mt-1">
                  <a href={`tel:${contacts.phoneFragrancesFlavours.tel}`} className="hover:text-bronze-text">
                    {contacts.phoneFragrancesFlavours.display}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Hours</dt>
                <dd className="mt-1">{contacts.hours}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
