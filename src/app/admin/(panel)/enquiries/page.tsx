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
import { firstParam, listHref, pageParam } from "@/features/admin/search-params";
import { listEnquiries, missingRecipientTypes } from "@/features/enquiries/queries";
import { ENQUIRY_STATUSES, ENQUIRY_TYPES, STATUS_LABELS, TYPE_LABELS, isEnquiryStatus } from "@/features/enquiries/status";
import { requireAction } from "@/lib/permissions";

export const instant = false;
export const metadata = adminMetadata("Enquiries");

const PATH = "/admin/enquiries";

export default async function AdminEnquiriesPage({ searchParams }: PageProps<"/admin/enquiries">) {
  await requireAction("enquiries.view");
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const rawStatus = firstParam(sp.status);
  const status = isEnquiryStatus(rawStatus) ? rawStatus : undefined;
  const [result, missing] = await Promise.all([
    listEnquiries({ q: q || undefined, status, page: pageParam(sp.page) }),
    missingRecipientTypes(),
  ]);
  const filtered = Boolean(q || status);
  const noneConfigured = missing.length === ENQUIRY_TYPES.length;

  return (
    <>
      <PageHeader title="Enquiries">
        {result.total} {result.total === 1 ? "enquiry" : "enquiries"}
        {filtered ? " match" : ""}, newest first
      </PageHeader>

      {missing.length > 0 ? (
        <div data-testid="recipients-warning" className="mt-6 border-l-4 border-bronze-text bg-white p-4 text-sm leading-relaxed">
          <p className="font-semibold">
            {noneConfigured
              ? "No notification recipients are configured for any enquiry type."
              : "Some enquiry types have no notification recipients."}
          </p>
          <p className="mt-1 text-muted-foreground">
            New enquiries are still stored and listed here, but no internal email is sent for:{" "}
            {missing.map((t) => TYPE_LABELS[t]).join(", ")}. Recipients are set in the{" "}
            <span className="font-mono text-xs">notification.recipients.&lt;type&gt;</span> site settings.
          </p>
        </div>
      ) : null}

      <form method="get" action={PATH} className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="enquiry-q" className={labelCls}>
            Search reference, name, company or email
          </label>
          <input id="enquiry-q" name="q" type="search" defaultValue={q} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label htmlFor="enquiry-status" className={labelCls}>
            Status
          </label>
          <select id="enquiry-status" name="status" defaultValue={status ?? ""} className={inputCls}>
            <option value="">All statuses</option>
            {ENQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
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
          {filtered ? "No enquiries match these filters." : "No enquiries have been received yet."}
        </p>
      ) : (
        <TableScroller label="Enquiries">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">Enquiries, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={thCls}>Reference</th>
                <th scope="col" className={thCls}>Received</th>
                <th scope="col" className={thCls}>Name</th>
                <th scope="col" className={thCls}>Company</th>
                <th scope="col" className={thCls}>Email</th>
                <th scope="col" className={thCls}>Type</th>
                <th scope="col" className={thCls}>Lines</th>
                <th scope="col" className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((e) => (
                <tr key={e.id} data-testid="enquiry-row">
                  <th scope="row" className={`${tdCls} whitespace-nowrap text-left`}>
                    <Link href={`${PATH}/${e.id}`} className={`${linkCls} font-mono text-xs`}>
                      {e.reference}
                    </Link>
                  </th>
                  <td className={`${tdCls} whitespace-nowrap text-xs`}>
                    <Timestamp value={e.createdAt} />
                  </td>
                  <td className={tdCls}>{e.fullName}</td>
                  <td className={tdCls}>{e.companyName ?? "\u{2014}"}</td>
                  <td className={`${tdCls} break-all`}>{e.email}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{TYPE_LABELS[e.type]}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>
                    {e.itemCount}
                    {e.attachmentCount > 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        + {e.attachmentCount} {e.attachmentCount === 1 ? "file" : "files"}
                      </span>
                    ) : null}
                  </td>
                  <td className={tdCls}>
                    <Badge value={e.status}>{STATUS_LABELS[e.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={(page) => listHref(PATH, { q, status, page })}
      />
    </>
  );
}
