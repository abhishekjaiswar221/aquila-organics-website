import { certificationsMeta } from "@/content/certifications";
import type { CertificateRecord } from "@/content/types";
import { activeCertificates, expiredCertificates } from "@/lib/certificates";
import { Breadcrumbs } from "./breadcrumbs";

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Entry({ cert }: { cert: CertificateRecord }) {
  return (
    <li className="border-t border-charcoal pt-6">
      <h3 className="text-display-md">{cert.title}</h3>
      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        {cert.issuer ? (
          <>
            <dt className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Issuing body</dt>
            <dd>{cert.issuer}</dd>
          </>
        ) : null}
        {cert.issuedOn ? (
          <>
            <dt className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Issued</dt>
            <dd>{formatDay(cert.issuedOn)}</dd>
          </>
        ) : null}
        {cert.expiresOn ? (
          <>
            <dt className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Expires</dt>
            <dd>{formatDay(cert.expiresOn)}</dd>
          </>
        ) : null}
        {cert.scope ? (
          <>
            <dt className="font-mono text-xs uppercase tracking-[0.18em] text-bronze-text">Covers</dt>
            <dd>{cert.scope}</dd>
          </>
        ) : null}
      </dl>
      {cert.documentPath ? (
        <p className="mt-4">
          <a href={cert.documentPath} className="text-bronze-text underline underline-offset-4">
            View document
          </a>
        </p>
      ) : null}
    </li>
  );
}

interface Props {
  certificates: readonly CertificateRecord[];
  /** Injected so expiry is deterministic in tests; pages pass the current time. */
  now: Date;
  /** Shown whenever there is no current certificate to list. */
  pending: string;
}

/**
 * Lists only confirmed certificates. Active ones appear under "Current certificates"; expired
 * ones only under an explicit "Expired certificates" heading. Unconfirmed entries never render.
 */
export function CertificationsPage({ certificates, now, pending }: Props) {
  const active = activeCertificates(certificates, now);
  const expired = expiredCertificates(certificates, now);
  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <Breadcrumbs
          trail={[
            { name: "Home", path: "/" },
            { name: "Sustainability", path: "/sustainability" },
            { name: certificationsMeta.title, path: "/sustainability/certifications" },
          ]}
        />
      </div>
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 lg:pb-16 lg:pt-20">
        <h1 className="text-display-xl">{certificationsMeta.title}</h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{certificationsMeta.lead}</p>
      </section>
      <div className="mx-auto max-w-7xl space-y-16 px-6 pb-20 lg:pb-28">
        {active.length > 0 ? (
          <section aria-labelledby="current-title">
            <h2 id="current-title" className="text-display-lg">
              Current certificates
            </h2>
            <ul className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2">
              {active.map((c) => (
                <Entry key={c.id} cert={c} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="max-w-2xl text-lg leading-relaxed">{pending}</p>
        )}
        {expired.length > 0 ? (
          <section aria-labelledby="expired-title">
            <h2 id="expired-title" className="text-display-md">
              Expired certificates
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">These are no longer current.</p>
            <ul className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-2">
              {expired.map((c) => (
                <Entry key={c.id} cert={c} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
