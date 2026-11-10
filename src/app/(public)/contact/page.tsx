import type { Metadata } from "next";
import { ContactForms } from "@/components/forms/contact-forms";
import { Breadcrumbs } from "@/components/pages/breadcrumbs";
import { JsonLd } from "@/components/pages/json-ld";
import { Eyebrow } from "@/components/ui/eyebrow";
import { visibleBlocks } from "@/content";
import { contactChannels, contactHours, contactMeta, contactPhones } from "@/content/contact";
import { flavourSegment, fragranceSegment } from "@/content/segments";
import { addresses } from "@/content/site";
import { CONTACT_PATH } from "@/features/contact/confirmation";
import { parseContactParams } from "@/features/contact/query-params";
import { buildPageMetadata, pageBreadcrumbJsonLd, type Crumb } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/site-url";

/*
 * Cache Components: reads searchParams (the ?type= and ?application= prefill)
 * on every request and renders the whole response before sending it, the same
 * pattern as the catalogue list. `instant = false` declares that blocking is
 * intended. The prefill is validated against fixed lists by
 * parseContactParams; anything else is dropped and nothing from the URL is
 * rendered.
 *
 * Named individuals (hiddenContacts) are never imported here.
 */
export const instant = false;

const TRAIL: Crumb[] = [
  { name: "Home", path: "/" },
  { name: contactMeta.title, path: CONTACT_PATH },
];

/** The flavours mailbox appears only inside the Flavours form panel. */
const FLAVOURS_CHANNEL_ID = "channel-flavours";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({ title: contactMeta.title, description: contactMeta.description, path: CONTACT_PATH });
}

const labelCls = "font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground";
const linkCls = "underline underline-offset-4 hover:text-bronze-text";

const options = (applications: readonly { slug: string; name: string }[]) =>
  applications.map(({ slug, name }) => ({ slug, name }));

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const prefill = parseContactParams(await searchParams);
  const channels = visibleBlocks(contactChannels);
  const generalChannels = channels.filter((b) => b.id !== FLAVOURS_CHANNEL_ID);
  const flavoursMailbox = channels.find((b) => b.id === FLAVOURS_CHANNEL_ID)?.data.email;
  const phones = visibleBlocks(contactPhones);
  const [hours] = visibleBlocks([contactHours]);
  const offices = [addresses.headOffice, addresses.registeredOffice];

  return (
    <>
      <JsonLd data={pageBreadcrumbJsonLd(TRAIL, SITE_URL)} />
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs trail={TRAIL} />
      </div>

      <section aria-labelledby="contact-page-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-12 lg:pb-16 lg:pt-20">
          <Eyebrow>Company / Contact</Eyebrow>
          <h1 id="contact-page-title" className="text-display-xl mt-5">
            {contactMeta.title}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{contactMeta.lead}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-12 lg:grid-cols-12 lg:gap-12 lg:py-16">
        <section aria-labelledby="contact-forms-title" className="min-w-0 lg:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="contact-forms-title" className="text-2xl sm:text-3xl">
              Send us a message
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              All fields are required unless marked optional
            </p>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Choose the form that matches your enquiry, so it reaches the right team.
          </p>
          <div className="mt-8">
            <ContactForms
              initialType={prefill.type}
              initialApplication={prefill.application}
              applications={{
                FRAGRANCES: options(fragranceSegment.applications),
                FLAVOURS: options(flavourSegment.applications),
              }}
              flavoursMailbox={flavoursMailbox}
            />
          </div>
        </section>

        <section aria-labelledby="contact-details-title" className="min-w-0 lg:col-span-4">
          <div className="border-t border-charcoal pt-6">
            <h2 id="contact-details-title" className="text-2xl sm:text-3xl">
              Contact details
            </h2>

            <h3 className={`${labelCls} mt-8`}>Offices</h3>
            <div className="mt-3 space-y-5 text-sm leading-relaxed">
              {offices.map((office) => (
                <div key={office.label}>
                  <p className="font-medium">{office.label}</p>
                  <address className="mt-1 not-italic text-muted-foreground">
                    {office.lines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </div>
              ))}
            </div>

            {phones.length ? (
              <>
                <h3 className={`${labelCls} mt-10`}>Telephone</h3>
                <dl className="mt-3 space-y-4 text-sm">
                  {phones.map((p) => (
                    <div key={p.id}>
                      <dt className="text-muted-foreground">{p.data.label}</dt>
                      <dd className="mt-1">
                        <a href={`tel:${p.data.tel}`} className={linkCls}>
                          {p.data.display}
                        </a>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {generalChannels.length ? (
              <>
                <h3 className={`${labelCls} mt-10`}>Email</h3>
                <dl className="mt-3 space-y-4 text-sm">
                  {generalChannels.map((c) => (
                    <div key={c.id}>
                      <dt className="text-muted-foreground">{c.data.label}</dt>
                      <dd className="mt-1 wrap-break-word">
                        <a href={`mailto:${c.data.email}`} className={linkCls}>
                          {c.data.email}
                        </a>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {hours ? (
              <>
                <h3 className={`${labelCls} mt-10`}>Hours</h3>
                <p className="mt-3 text-sm">{hours.data}</p>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
