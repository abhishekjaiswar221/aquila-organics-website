import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ApplicationDeleteForm } from "@/components/admin/application-delete-form";
import { ApplicationStatusForm } from "@/components/admin/application-status-form";
import { Badge, PageHeader, SectionTitle, Timestamp, formatBytes, linkCls } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { getApplication } from "@/features/careers/application-queries";
import { APPLICATION_STATUS_LABELS } from "@/features/careers/application-status";
import { can, requireAction } from "@/lib/permissions";

export const instant = false;
// Static title: the reference is not put in metadata, which is resolved alongside the auth check.
export const metadata = adminMetadata("Application");

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-charcoal/10 py-2.5 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 whitespace-pre-line break-words sm:mt-0">{children ?? "\u{2014}"}</dd>
    </div>
  );
}

export default async function AdminApplicationPage({ params }: PageProps<"/admin/applications/[id]">) {
  const { role } = await requireAction("applications.view");
  const application = await getApplication((await params).id);
  if (!application) notFound();
  const canUpdate = can(role, "applications.update");

  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/admin/applications" className={linkCls}>
          <span aria-hidden>&larr; </span>All applications
        </Link>
      </p>
      <PageHeader
        title={
          <>
            Application <span className="font-mono text-2xl sm:text-3xl">{application.reference}</span>
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-3">
          <Badge value={application.status}>{APPLICATION_STATUS_LABELS[application.status]}</Badge>
          <span>
            {application.jobTitleSnapshot} &middot; received <Timestamp value={application.createdAt} />
          </span>
        </span>
      </PageHeader>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="candidate-title">
            <SectionTitle id="candidate-title">Candidate</SectionTitle>
            <dl className="mt-3 border-b border-charcoal/10 bg-white px-4 text-sm">
              <Field label="Name">{application.fullName}</Field>
              <Field label="Email">
                <a href={`mailto:${application.email}`} className={`${linkCls} break-all`}>
                  {application.email}
                </a>
              </Field>
              <Field label="Telephone">{application.phone}</Field>
              <Field label="Country">{application.country}</Field>
              <Field label="Opening">{application.jobTitleSnapshot}</Field>
              <Field label="Message">{application.message}</Field>
              <Field label="Consent given">
                <Timestamp value={application.consentAt} />
              </Field>
            </dl>
          </section>

          <section aria-labelledby="cv-title">
            <SectionTitle id="cv-title">CV ({application.files.length})</SectionTitle>
            {application.files.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No CV is stored for this application.</p>
            ) : (
              <ul className="mt-3 divide-y divide-charcoal/10 border border-charcoal/20 bg-white text-sm">
                {application.files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <a
                      href={`/api/admin/applications/${application.id}/cv`}
                      download
                      className={`${linkCls} min-w-0 break-all`}
                    >
                      {f.filename}
                    </a>
                    <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatBytes(f.sizeBytes)} &middot; {f.mimeType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {canUpdate ? (
          <div className="min-w-0 space-y-10">
            <section aria-labelledby="status-title">
              <SectionTitle id="status-title">Change status</SectionTitle>
              <ApplicationStatusForm applicationId={application.id} status={application.status} />
            </section>
            <section aria-labelledby="delete-title">
              <SectionTitle id="delete-title">Delete</SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Removes this application and its CV from the admin. This cannot be undone.
              </p>
              <ApplicationDeleteForm applicationId={application.id} />
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}
