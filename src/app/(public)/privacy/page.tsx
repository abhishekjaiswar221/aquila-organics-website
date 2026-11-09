import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { addresses, company, contacts } from "@/content/site";
import { RFQ_PATH } from "@/features/enquiries/confirmation";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How the Aquila Organics website handles the information you send through its enquiry forms. Draft under review.",
  alternates: { canonical: "/privacy" },
};

/*
 * DRAFT pending legal review (docs/content-verification.md, section H). It
 * describes only what the code does today and claims no compliance with any
 * named law or scheme. Retention periods are deliberately left to the client.
 */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-charcoal/20 pt-8">
      <h2 id={id} className="text-2xl sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

const linkCls = "text-bronze-text underline underline-offset-4";

export default function PrivacyPage() {
  return (
    <>
      <section aria-labelledby="privacy-title" className="border-b border-charcoal/20">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-14 lg:pb-16 lg:pt-20">
          <Eyebrow>Legal / Draft</Eyebrow>
          <h1 id="privacy-title" className="text-display-lg mt-4">
            Privacy notice
          </h1>
          <div className="mt-8 max-w-3xl border-l-4 border-bronze-text bg-white px-5 py-4">
            <p className="font-medium">This notice is a draft and is being reviewed.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              It describes how this website handles your information today. It may change before it is finalised.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 lg:py-16">
        <Section id="who" title="Who we are">
          <p>
            This website is run by {company.name}. Our registered office is at{" "}
            {addresses.registeredOffice.lines.join(", ")}.
          </p>
        </Section>

        <Section id="collect" title="What we collect">
          <p>
            When you send a{" "}
            <Link href={RFQ_PATH} className={linkCls}>
              request for quotation
            </Link>
            , we receive:
          </p>
          <ul>
            <li>your name, company name, email address, telephone number and country;</li>
            <li>your business segment, the products and quantities you ask about, and any notes;</li>
            <li>what you tell us about your intended application and any other requirements;</li>
            <li>any files you choose to attach;</li>
            <li>the time you agreed to this notice.</li>
          </ul>
          <p>
            With each enquiry we also store your browser&rsquo;s user agent and a one-way code derived from your
            IP address. We use the code to limit repeated submissions and do not store the IP address itself.
          </p>
          <p>
            Careers and contact forms will be added to this website later. They will collect only the information
            shown on each form, and this notice will be updated before they go live.
          </p>
        </Section>

        <Section id="use" title="Why we use it">
          <ul>
            <li>to review and respond to your enquiry, including preparing a quotation;</li>
            <li>to contact you about your enquiry;</li>
            <li>to keep a record of the enquiries we receive;</li>
            <li>to protect the website and our team from spam and misuse.</li>
          </ul>
        </Section>

        <Section id="retention" title="How long we keep it">
          <p>Retention periods are to be confirmed by Aquila.</p>
        </Section>

        <Section id="sharing" title="Who we share it with">
          <p>We share your information only with service providers that help us run this website:</p>
          <ul>
            <li>our hosting provider, which stores the website and the enquiries sent through it;</li>
            <li>
              our email provider, which delivers the acknowledgement sent to you and the notification sent to our team.
            </li>
          </ul>
        </Section>

        <Section id="cookies" title="Cookies and browser storage">
          <p>The public website uses only what it needs to work:</p>
          <ul>
            <li>
              Products you add to an enquiry are remembered in your browser&rsquo;s local storage, as product
              identifiers only, until you send the enquiry or remove them. This stays on your device.
            </li>
            <li>
              Staff who sign in to the website&rsquo;s administration area use a session cookie. Visitors do not.
            </li>
          </ul>
        </Section>

        <Section id="requests" title="Your requests">
          <p>
            You can ask us what information we hold about you, and ask us to correct or delete it. Please write to{" "}
            <a href={`mailto:${contacts.general}`} className={linkCls}>
              {contacts.general}
            </a>
            . We may need to confirm your identity before acting on a request.
          </p>
        </Section>

        <Section id="changes" title="Changes to this notice">
          <p>
            This draft will be replaced by a reviewed notice. Any later changes will be published on this page.
          </p>
        </Section>
      </div>
    </>
  );
}
