import Link from "next/link";
import { JobActions } from "@/components/admin/job-actions";
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
import { firstParam, listHref, pageParam } from "@/features/admin/search-params";
import { listAdminJobs } from "@/features/careers/job-queries";
import { EMPLOYMENT_LABELS, JOB_STATUSES, JOB_STATUS_LABELS, isJobStatus } from "@/features/careers/job-schema";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`: a change shows at once.
export const instant = false;
export const metadata = adminMetadata("Job openings");

const PATH = "/admin/jobs";

export default async function AdminJobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  await requireAction("jobs.manage");
  const sp = await searchParams;
  const rawStatus = firstParam(sp.status);
  const status = isJobStatus(rawStatus) ? rawStatus : undefined;
  const result = await listAdminJobs({ status, page: pageParam(sp.page) });

  return (
    <>
      <PageHeader title="Job openings">
        {result.total} {result.total === 1 ? "opening" : "openings"}
        {status ? " match" : " (all statuses)"}
      </PageHeader>

      <p className="mt-4">
        <Link href="/admin/jobs/new" className={buttonCls}>
          New opening
        </Link>
      </p>

      <form method="get" action={PATH} className="mt-6 grid gap-3 sm:grid-cols-[12rem_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="job-status" className={labelCls}>
            Status
          </label>
          <select id="job-status" name="status" defaultValue={status ?? ""} className={inputCls}>
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" className={buttonCls}>
            Filter
          </button>
          {status ? (
            <Link href={PATH} className={`${linkCls} text-sm`}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Publishing shows an opening on the public careers pages at once. Closing it, or passing its closing date, removes
        it. Only a draft with no applications can be deleted.
      </p>

      {result.items.length === 0 ? (
        <p className="mt-6 border border-charcoal/20 bg-white p-4 text-sm">
          {status ? "No openings have this status." : "There are no openings yet."}
        </p>
      ) : (
        <TableScroller label="Job openings">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">Job openings, all statuses</caption>
            <thead>
              <tr>
                <th scope="col" className={thCls}>Title</th>
                <th scope="col" className={thCls}>Location</th>
                <th scope="col" className={thCls}>Type</th>
                <th scope="col" className={thCls}>Status</th>
                <th scope="col" className={thCls}>Closes</th>
                <th scope="col" className={thCls}>Updated</th>
                <th scope="col" className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((j) => (
                <tr key={j.id} data-testid="job-row">
                  <th scope="row" className={`${tdCls} min-w-48 text-left font-medium`}>
                    <span>{j.title}</span>
                    <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted-foreground">{j.slug}</span>
                  </th>
                  <td className={tdCls}>{j.location}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{EMPLOYMENT_LABELS[j.employmentType]}</td>
                  <td className={tdCls}>
                    <Badge value={j.status}>{JOB_STATUS_LABELS[j.status]}</Badge>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>{j.closesOn ? j.closesOn.toISOString().slice(0, 10) : "\u{2014}"}</td>
                  <td className={`${tdCls} whitespace-nowrap text-xs`}>
                    <Timestamp value={j.updatedAt} />
                  </td>
                  <td className={tdCls}>
                    <Link href={`/admin/jobs/${j.id}/edit`} className={`${linkCls} mb-2 inline-block`}>
                      Edit<span className="sr-only"> {j.title}</span>
                    </Link>
                    <JobActions jobId={j.id} jobTitle={j.title} status={j.status} applicationCount={j.applicationCount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => listHref(PATH, { status, page })} />
    </>
  );
}
