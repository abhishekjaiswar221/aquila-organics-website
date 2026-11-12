import Link from "next/link";
import {
  Badge,
  PageHeader,
  Pagination,
  TableScroller,
  Timestamp,
  buttonCls,
  inputCls,
  labelCls,
  linkCls,
  tdCls,
  thCls,
} from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { firstParam, pageParam } from "@/features/admin/search-params";
import { listApplications, listJobFilterOptions } from "@/features/careers/application-queries";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, isApplicationStatus } from "@/features/careers/application-status";
import { RecipientsForm } from "@/components/admin/recipients-form";
import { getAllRecipients } from "@/features/settings/queries";
import { can, requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

export const instant = false;
export const metadata = adminMetadata("Applications");

const PATH = "/admin/applications";

function hrefFor(params: { status?: string; job?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.job) sp.set("job", params.job);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `${PATH}?${qs}` : PATH;
}

export default async function AdminApplicationsPage({ searchParams }: PageProps<"/admin/applications">) {
  const { role } = await requireAction("applications.view");
  const sp = await searchParams;
  const rawStatus = firstParam(sp.status);
  const status = isApplicationStatus(rawStatus) ? rawStatus : undefined;
  const jobId = normalizeUuid(firstParam(sp.job)) ?? undefined;
  const [result, jobs, recipients] = await Promise.all([
    listApplications({ status, jobId, page: pageParam(sp.page) }),
    listJobFilterOptions(),
    getAllRecipients(),
  ]);
  const filtered = Boolean(status || jobId);

  return (
    <>
      <PageHeader title="Applications">
        {result.total} {result.total === 1 ? "application" : "applications"}
        {filtered ? " match" : ""}, newest first
      </PageHeader>

      <form method="get" action={PATH} className="mt-6 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="application-status" className={labelCls}>
            Status
          </label>
          <select id="application-status" name="status" defaultValue={status ?? ""} className={inputCls}>
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="application-job" className={labelCls}>
            Opening
          </label>
          <select id="application-job" name="job" defaultValue={jobId ?? ""} className={inputCls}>
            <option value="">All openings</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" className={buttonCls}>
            Filter
          </button>
          {filtered ? (
            <Link href={PATH} className={`${linkCls} text-sm`}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {result.items.length === 0 ? (
        <p className="mt-6 border border-charcoal/20 bg-white p-4 text-sm">
          {filtered ? "No applications match these filters." : "No applications have been received yet."}
        </p>
      ) : (
        <TableScroller label="Applications">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">Applications, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={thCls}>Reference</th>
                <th scope="col" className={thCls}>Received</th>
                <th scope="col" className={thCls}>Name</th>
                <th scope="col" className={thCls}>Email</th>
                <th scope="col" className={thCls}>Opening</th>
                <th scope="col" className={thCls}>CV</th>
                <th scope="col" className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((a) => (
                <tr key={a.id} data-testid="application-row">
                  <th scope="row" className={`${tdCls} whitespace-nowrap text-left`}>
                    <Link href={`${PATH}/${a.id}`} className={`${linkCls} font-mono text-xs`}>
                      {a.reference}
                    </Link>
                  </th>
                  <td className={`${tdCls} whitespace-nowrap text-xs`}>
                    <Timestamp value={a.createdAt} />
                  </td>
                  <td className={tdCls}>{a.fullName}</td>
                  <td className={`${tdCls} break-all`}>{a.email}</td>
                  <td className={tdCls}>{a.jobTitleSnapshot}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{a.fileCount > 0 ? "Yes" : "No"}</td>
                  <td className={tdCls}>
                    <Badge value={a.status}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      )}

      {can(role, "applications.update") ? (
        <section aria-labelledby="careers-recipients-heading" className="mt-10 max-w-2xl">
          <h2 id="careers-recipients-heading" className="text-xl">
            Notification recipients
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New applications are emailed to this list with the candidate&apos;s details. Only people who may see applications
            should be on it.
          </p>
          <RecipientsForm type="CAREERS" label="Careers applications" recipients={recipients.CAREERS} />
        </section>
      ) : null}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={(page) => hrefFor({ status, job: jobId, page })}
      />
    </>
  );
}
