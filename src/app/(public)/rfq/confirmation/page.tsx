import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";
import { contacts } from "@/content/site";
import { RFQ_PATH, parseConfirmationRef } from "@/features/enquiries/confirmation";
import { CATALOGUE_PATH } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Enquiry sent",
  description: "Confirmation of your request for quotation to Aquila Organics.",
  robots: { index: false, follow: false },
};

/*
 * Cache Components: reads searchParams on every request and renders the whole
 * response before sending it (no <Suspense>), the same documented pattern as
 * the catalogue list. `instant = false` declares that blocking is intended
 * and opts the route out of static-shell validation.
 *
 * The URL carries the reference only. It is checked against the reference
 * format and never echoed otherwise; nothing is looked up, so the page shows
 * no enquiry data.
 */
export const instant = false;

const linkCls = "underline underline-offset-4 hover:text-bronze-text";

export default async function ConfirmationPage({ searchParams }: PageProps<"/rfq/confirmation">) {
  const reference = parseConfirmationRef((await searchParams).ref);

  return (
    <>
      <section aria-labelledby="confirmation-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-14 lg:pb-16 lg:pt-20">
          <Eyebrow>Enquiry / Confirmation</Eyebrow>
          {reference ? (
            <>
              <h1 id="confirmation-title" className="text-display-lg mt-4 max-w-4xl">
                Thank you. Your enquiry has been sent.
              </h1>
              <div className="mt-10 inline-block border border-charcoal bg-white px-6 py-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Your reference
                </p>
                <p data-testid="enquiry-reference" className="mt-2 font-mono text-2xl tracking-wide sm:text-3xl">
                  {reference}
                </p>
              </div>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Please quote this reference if you contact us about this enquiry.
              </p>
            </>
          ) : (
            <>
              <h1 id="confirmation-title" className="text-display-lg mt-4 max-w-4xl">
                Enquiry confirmation
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                There is no enquiry reference to show on this page. If you have just sent an enquiry and need its
                reference, please contact the sales team below. To send a new enquiry, use the{" "}
                <Link href={RFQ_PATH} className={linkCls}>
                  request for quotation form
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-2 lg:py-16">
        {reference ? (
          <section aria-labelledby="next-title" className="min-w-0 border-t border-charcoal pt-6">
            <h2 id="next-title" className="text-2xl sm:text-3xl">
              What happens next
            </h2>
            <ol className="mt-6 space-y-4 text-base leading-relaxed">
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)]">
                <span aria-hidden className="font-mono text-xs leading-7 text-bronze-text">
                  01
                </span>
                <span>A member of the team will review your enquiry and respond.</span>
              </li>
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)]">
                <span aria-hidden className="font-mono text-xs leading-7 text-bronze-text">
                  02
                </span>
                <span>
                  If an email address was provided, you will normally receive an acknowledgement by email with your
                  reference.
                </span>
              </li>
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)]">
                <span aria-hidden className="font-mono text-xs leading-7 text-bronze-text">
                  03
                </span>
                <span>
                  If anything changes in the meantime, contact us and quote your reference.
                </span>
              </li>
            </ol>
            <p className="mt-8 text-sm">
              <Link href={CATALOGUE_PATH} className={linkCls}>
                Back to the catalogue
              </Link>
            </p>
          </section>
        ) : null}

        <section aria-labelledby="contact-title" className="min-w-0 border-t border-charcoal pt-6">
          <h2 id="contact-title" className="text-2xl sm:text-3xl">
            Contact the sales team
          </h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Email</dt>
              <dd className="mt-1">
                <a href={`mailto:${contacts.sales}`} className={linkCls}>
                  {contacts.sales}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Aroma chemicals</dt>
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
        </section>
      </div>
    </>
  );
}
