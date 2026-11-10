import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";
import { contacts } from "@/content/site";
import { CONTACT_PATH } from "@/features/contact/confirmation";
import { RFQ_PATH } from "@/features/enquiries/confirmation";
import { CATALOGUE_PATH } from "@/lib/seo/site-url";

/*
 * The confirmation shown after an enquiry is sent: the reference (already
 * validated by the page) and next steps, never any enquiry data. `kind` comes
 * from the route (/rfq/confirmation or /contact/confirmation), never from the
 * URL's query, which carries the reference only.
 */

export type ConfirmationKind = "rfq" | "contact";

const COPY = {
  rfq: {
    eyebrow: "Enquiry / Confirmation",
    sentTitle: "Thank you. Your enquiry has been sent.",
    quote: "Please quote this reference if you contact us about this enquiry.",
    emptyTitle: "Enquiry confirmation",
    emptyLead: (
      <>
        There is no enquiry reference to show on this page. If you have just sent an enquiry and need its reference,
        please contact the sales team below. To send a new enquiry, use the{" "}
        <Link href={RFQ_PATH} className="underline underline-offset-4 hover:text-bronze-text">
          request for quotation form
        </Link>
        .
      </>
    ),
    review: "A member of the team will review your enquiry and respond.",
    back: { href: CATALOGUE_PATH, label: "Back to the catalogue" },
    contactTitle: "Contact the sales team",
    email: contacts.sales,
  },
  contact: {
    eyebrow: "Contact / Confirmation",
    sentTitle: "Thank you. Your message has been sent.",
    quote: "Please quote this reference if you contact us about this message.",
    emptyTitle: "Message confirmation",
    emptyLead: (
      <>
        There is no message reference to show on this page. If you have just sent a message and need its reference,
        please contact us using the details below. To send a new message, use the{" "}
        <Link href={CONTACT_PATH} className="underline underline-offset-4 hover:text-bronze-text">
          contact page
        </Link>
        .
      </>
    ),
    review: "A member of the team will review your message and respond.",
    back: { href: CONTACT_PATH, label: "Back to the contact page" },
    contactTitle: "Contact us",
    email: contacts.general,
  },
} as const;

const linkCls = "underline underline-offset-4 hover:text-bronze-text";

export function EnquiryConfirmation({ kind, reference }: { kind: ConfirmationKind; reference: string | null }) {
  const copy = COPY[kind];
  return (
    <>
      <section aria-labelledby="confirmation-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-14 lg:pb-16 lg:pt-20">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          {reference ? (
            <>
              <h1 id="confirmation-title" className="text-display-lg mt-4 max-w-4xl">
                {copy.sentTitle}
              </h1>
              <div className="mt-10 inline-block border border-charcoal bg-white px-6 py-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Your reference
                </p>
                <p data-testid="enquiry-reference" className="mt-2 font-mono text-2xl tracking-wide sm:text-3xl">
                  {reference}
                </p>
              </div>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{copy.quote}</p>
            </>
          ) : (
            <>
              <h1 id="confirmation-title" className="text-display-lg mt-4 max-w-4xl">
                {copy.emptyTitle}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{copy.emptyLead}</p>
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
                <span>{copy.review}</span>
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
              <Link href={copy.back.href} className={linkCls}>
                {copy.back.label}
              </Link>
            </p>
          </section>
        ) : null}

        <section aria-labelledby="contact-title" className="min-w-0 border-t border-charcoal pt-6">
          <h2 id="contact-title" className="text-2xl sm:text-3xl">
            {copy.contactTitle}
          </h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Email</dt>
              <dd className="mt-1">
                <a href={`mailto:${copy.email}`} className={linkCls}>
                  {copy.email}
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
