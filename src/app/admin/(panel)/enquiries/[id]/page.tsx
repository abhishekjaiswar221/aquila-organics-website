import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EnquiryStatusForm } from "@/components/admin/enquiry-status-form";
import {
  Badge,
  PageHeader,
  SectionTitle,
  TableScroller,
  Timestamp,
  formatBytes,
  linkCls,
  tdCls,
  thCls,
} from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { describeActivity } from "@/features/enquiries/activity-text";
import { isSpreadsheetAttachment } from "@/features/enquiries/attachment-download";
import { enquiryMessageLabel, showProductsSection } from "@/features/enquiries/display";
import { getEnquiry } from "@/features/enquiries/queries";
import { BUSINESS_SEGMENT_LABELS, BUSINESS_SEGMENTS, UNIT_LABELS } from "@/features/enquiries/schema";
import { STATUS_LABELS, TYPE_LABELS } from "@/features/enquiries/status";
import { requireRole } from "@/lib/permissions";

export const instant = false;
// Static title: the reference is not put in metadata, which is resolved alongside the auth check.
export const metadata = adminMetadata("Enquiry");

function segmentLabel(value: string | null): string | null {
  if (!value) return null;
  return (BUSINESS_SEGMENTS as readonly string[]).includes(value)
    ? BUSINESS_SEGMENT_LABELS[value as keyof typeof BUSINESS_SEGMENT_LABELS]
    : value;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-charcoal/10 py-2.5 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 whitespace-pre-line break-words sm:mt-0">{children ?? "\u{2014}"}</dd>
    </div>
  );
}

export default async function AdminEnquiryPage({ params }: PageProps<"/admin/enquiries/[id]">) {
  await requireRole();
  const enquiry = await getEnquiry((await params).id);
  if (!enquiry) notFound();
  const attachmentNames = new Map(enquiry.attachments.map((a) => [a.id, a.filename]));

  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/admin/enquiries" className={linkCls}>
          <span aria-hidden>&larr; </span>All enquiries
        </Link>
      </p>
      <PageHeader
        title={
          <>
            Enquiry <span className="font-mono text-2xl sm:text-3xl">{enquiry.reference}</span>
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-3">
          <Badge value={enquiry.status}>{STATUS_LABELS[enquiry.status]}</Badge>
          <span>
            {TYPE_LABELS[enquiry.type]} &middot; received <Timestamp value={enquiry.createdAt} />
          </span>
        </span>
      </PageHeader>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="contact-title">
            <SectionTitle id="contact-title">Contact</SectionTitle>
            <dl className="mt-3 border-b border-charcoal/10 bg-white px-4 text-sm">
              <Field label="Name">{enquiry.fullName}</Field>
              <Field label="Company">{enquiry.companyName}</Field>
              <Field label="Email">
                <a href={`mailto:${enquiry.email}`} className={`${linkCls} break-all`}>
                  {enquiry.email}
                </a>
              </Field>
              <Field label="Telephone">{enquiry.phone}</Field>
              <Field label="Country">{enquiry.country}</Field>
              <Field label="Business segment">{segmentLabel(enquiry.businessSegment)}</Field>
              <Field label="Intended application">{enquiry.intendedApplication}</Field>
              <Field label={enquiryMessageLabel(enquiry.items.length)}>{enquiry.additionalRequirements}</Field>
              <Field label="Consent given">
                <Timestamp value={enquiry.consentAt} />
              </Field>
            </dl>
          </section>

          {showProductsSection(enquiry.items.length) ? (
          <section aria-labelledby="items-title">
            <SectionTitle id="items-title">Products ({enquiry.items.length})</SectionTitle>
            <TableScroller label="Requested products">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={thCls}>Product</th>
                    <th scope="col" className={thCls}>CAS</th>
                    <th scope="col" className={thCls}>Quantity</th>
                    <th scope="col" className={thCls}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiry.items.map((item) => (
                    <tr key={item.id}>
                      <th scope="row" className={`${tdCls} text-left font-medium`}>
                        {item.productNameSnapshot}
                        {item.productId ? null : (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Free text line</span>
                        )}
                      </th>
                      <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{item.casSnapshot ?? "\u{2014}"}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        {item.quantity} {UNIT_LABELS[item.unit]}
                      </td>
                      <td className={`${tdCls} whitespace-pre-line break-words`}>{item.notes ?? "\u{2014}"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
          </section>
          ) : null}

          <section aria-labelledby="attachments-title">
            <SectionTitle id="attachments-title">Attachments ({enquiry.attachments.length})</SectionTitle>
            {enquiry.attachments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No files were attached.</p>
            ) : (
              <ul className="mt-3 divide-y divide-charcoal/10 border border-charcoal/20 bg-white text-sm">
                {enquiry.attachments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0">
                      <a href={`/api/admin/attachments/${a.id}`} download className={`${linkCls} break-all`}>
                        {a.filename}
                      </a>
                      {isSpreadsheetAttachment(a.mimeType) ? (
                        <p className="mt-1 text-xs text-bronze-text">
                          Open with care: spreadsheet files can contain formulas.
                        </p>
                      ) : null}
                    </div>
                    <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatBytes(a.sizeBytes)} &middot; {a.mimeType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-10">
          <section aria-labelledby="status-title">
            <SectionTitle id="status-title">Change status</SectionTitle>
            <EnquiryStatusForm enquiryId={enquiry.id} status={enquiry.status} />
          </section>

          <section aria-labelledby="activity-title">
            <SectionTitle id="activity-title">Activity</SectionTitle>
            <ol className="mt-3 space-y-0 border-l border-charcoal/30 text-sm" data-testid="activity">
              {enquiry.activities.map((a) => (
                <li key={a.id} className="relative py-2 pl-4">
                  <span aria-hidden className="absolute -left-[4px] top-[1.05rem] size-[7px] bg-charcoal" />
                  <p className="leading-snug">{describeActivity(a.action, a.detail, attachmentNames)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Timestamp value={a.createdAt} /> &middot;{" "}
                    {a.actorId ? (
                      <>
                        by user <span className="font-mono">{a.actorId.slice(0, 8)}</span>
                      </>
                    ) : (
                      "system"
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
