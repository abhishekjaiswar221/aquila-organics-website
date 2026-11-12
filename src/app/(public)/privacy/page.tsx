import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { addresses, company, contacts } from "@/content/site";
import { RFQ_PATH } from "@/features/enquiries/confirmation";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How the Aquila Organics website handles the information you send through its enquiry forms and job applications. Draft under review.",
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
            To limit how many acknowledgement emails one email address can receive, we also keep a count against
            a one-way code derived from that address; this count does not contain the address itself.
          </p>
          <p>
            The contact forms collect the same details as the quotation request (name, company, email, telephone
            and country) plus the message you write and any files you attach, and are handled in the same way,
            including the limits above.
          </p>
          <p>
            When you apply for a job through the{" "}
            <Link href="/careers" className={linkCls}>
              careers pages
            </Link>
            , we receive your name, email address, telephone number (optional), country (optional), the message you
            write (optional), your CV (a PDF or DOCX file), the opening you applied for, and the time you agreed to
            this notice. We also store your browser&rsquo;s user agent and a one-way code derived from your IP
            address, for the same reasons as above. Your CV and details are visible in the admin only to
            Aquila&rsquo;s HR team and super administrators, who can review, download and delete them. A
            notification email with your details (but not your CV file) is also sent to the careers recipients that
            HR chooses, so a copy may remain in those mailboxes after an application is deleted from the website.
            They are not shown on the website, and the acknowledgement we send you contains only your reference.
          </p>
        </Section>

        <Section id="use" title="Why we use it">
          <ul>
            <li>to review and respond to your enquiry, including preparing a quotation;</li>
            <li>to contact you about your enquiry;</li>
            <li>to keep a record of the enquiries we receive;</li>
            <li>to consider your job application and contact you about it;</li>
            <li>to protect the website and our team from spam and misuse.</li>
          </ul>
        </Section>

        <Section id="retention" title="How long we keep it">
          <p>
            Retention periods are to be confirmed by Aquila, for enquiries and for job applications alike. Until
            they are set, applications and CVs are kept until our HR team deletes them.
          </p>
        </Section>

        <Section id="sharing" title="Who we share it with">
          <p>We share your information only with service providers that help us run this website:</p>
          <ul>
            <li>
              our hosting provider, which stores the website and the enquiries and job applications sent through it;
            </li>
            <li>
              our file storage provider, which holds the CVs and attachments you upload, in storage that is not
              publicly accessible;
            </li>
            <li>
              our email provider, which delivers the acknowledgement sent to you and the notification sent to our
              team (for a job application, the notification to our HR team includes your details).
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
            You can ask us what information we hold about you, and ask us to correct or delete it, including a job
            application and its CV. Please write to{" "}
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
