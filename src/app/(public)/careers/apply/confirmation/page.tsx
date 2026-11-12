import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";
import { contacts } from "@/content/site";
import { CAREERS_APPLY_PATH, CAREERS_PATH, parseApplicationRef } from "@/features/careers/paths";

export const metadata: Metadata = {
  title: "Application sent",
  description: "Confirmation of your application to Aquila Organics.",
  robots: { index: false, follow: false },
};

/*
 * Same pattern as the contact confirmation: reads searchParams on every request
 * (`instant = false`), shows only a reference that matches the application
 * reference format and never echoes anything else from the URL or the form.
 */
export const instant = false;

const linkCls = "underline underline-offset-4 hover:text-bronze-text";

export default async function ApplicationConfirmationPage({ searchParams }: PageProps<"/careers/apply/confirmation">) {
  const reference = parseApplicationRef((await searchParams).ref);
  return (
    <section aria-labelledby="confirmation-title" className="border-b border-charcoal/20">
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-14 lg:pb-24 lg:pt-20">
        <Eyebrow>Careers / Confirmation</Eyebrow>
        {reference ? (
          <>
            <h1 id="confirmation-title" className="text-display-lg mt-4 max-w-4xl">
              Thank you. Your application has been sent.
            </h1>
            <div className="mt-10 inline-block border border-charcoal bg-white px-6 py-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your reference</p>
              <p data-testid="application-reference" className="mt-2 font-mono text-2xl tracking-wide sm:text-3xl">
                {reference}
              </p>
            </div>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Please quote this reference if you contact us about this application. A member of the HR team will
              review it.
            </p>
          </>
        ) : (
          <>
            <h1 id="confirmation-title" className="text-display-lg mt-4 max-w-4xl">
              Application confirmation
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              There is no application reference to show on this page. If you have just applied and need your
              reference, please write to{" "}
              <a href={`mailto:${contacts.hr}`} className={linkCls}>
                {contacts.hr}
              </a>
              . To send a new application, use the{" "}
              <Link href={CAREERS_APPLY_PATH} className={linkCls}>
                application form
              </Link>
              .
            </p>
          </>
        )}
        <p className="mt-8 text-sm">
          <Link href={CAREERS_PATH} className={linkCls}>
            Back to careers
          </Link>
        </p>
      </div>
    </section>
  );
}
