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
import { AUDIT_ACTIONS } from "@/features/admin/audit";
import { AUDIT_PAGE_SIZE, isAuditAction, listAudit } from "@/features/admin/audit-queries";
import { adminMetadata } from "@/features/admin/metadata";
import { firstParam, pageParam } from "@/features/admin/search-params";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

// Per request (session + database), no `use cache`: new rows show at once.
export const instant = false;
export const metadata = adminMetadata("Audit log");

const PATH = "/admin/audit";
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` to a UTC midnight Date, or undefined for anything else. */
function dateParam(raw: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAction("audit.view");
  const sp = await searchParams;
  const rawAction = firstParam(sp.action);
  const action = isAuditAction(rawAction) ? rawAction : undefined;
  const actors = await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const actorId = normalizeUuid(firstParam(sp.actor)) ?? undefined;
  const entityType = firstParam(sp.entityType).trim().slice(0, 60);
  const rawFrom = firstParam(sp.from);
  const rawTo = firstParam(sp.to);
  const from = dateParam(rawFrom);
  const to = dateParam(rawTo);
  const page = pageParam(sp.page);

  // The "to" day is inclusive: up to the last millisecond of that day (UTC).
  const result = await listAudit({
    action,
    actorId,
    entityType: entityType || undefined,
    from,
    to: to ? new Date(to.getTime() + DAY_MS - 1) : undefined,
    page,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / AUDIT_PAGE_SIZE));
  const filtered = Boolean(action || actorId || entityType || from || to);

  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (actorId) q.set("actor", actorId);
    if (entityType) q.set("entityType", entityType);
    if (from) q.set("from", rawFrom);
    if (to) q.set("to", rawTo);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${PATH}?${qs}` : PATH;
  };

  return (
    <>
      <PageHeader title="Audit log">
        {result.total} {result.total === 1 ? "entry" : "entries"}
        {filtered ? " match" : " recorded"}. Times are UTC. Entries hold ids and field names only, never personal data.
      </PageHeader>

      <form method="get" action={PATH} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_10rem_10rem_auto] lg:items-end">
        <div className="min-w-0">
          <label htmlFor="audit-action" className={labelCls}>
            Action
          </label>
          <select id="audit-action" name="action" defaultValue={action ?? ""} className={inputCls}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-actor" className={labelCls}>
            Actor
          </label>
          <select id="audit-actor" name="actor" defaultValue={actorId ?? ""} className={inputCls}>
            <option value="">Anyone</option>
            {actors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-entity" className={labelCls}>
            Entity type
          </label>
          <input id="audit-entity" name="entityType" type="text" maxLength={60} defaultValue={entityType} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-from" className={labelCls}>
            From
          </label>
          <input id="audit-from" name="from" type="date" defaultValue={from ? rawFrom : ""} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-to" className={labelCls}>
            To
          </label>
          <input id="audit-to" name="to" type="date" defaultValue={to ? rawTo : ""} className={inputCls} />
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

      {result.rows.length === 0 ? (
        <p className="mt-6 border border-charcoal/20 bg-white p-4 text-sm">
          {filtered ? "No entries match these filters." : "Nothing has been recorded yet."}
        </p>
      ) : (
        <TableScroller label="Audit log">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">Audit log, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={thCls}>Time</th>
                <th scope="col" className={thCls}>Role</th>
                <th scope="col" className={thCls}>Action</th>
                <th scope="col" className={thCls}>Entity</th>
                <th scope="col" className={thCls}>Outcome</th>
                <th scope="col" className={thCls}>Changed fields</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} data-testid="audit-row">
                  <td className={`${tdCls} whitespace-nowrap`}>
                    <Timestamp value={r.at} />
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>{r.actorRole}</td>
                  <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{r.action}</td>
                  <td className={tdCls}>
                    {r.entityType}
                    {r.entityId ? (
                      <span className="mt-0.5 block break-all font-mono text-[11px] text-muted-foreground">{r.entityId}</span>
                    ) : null}
                  </td>
                  <td className={tdCls}>
                    <Badge value={r.outcome}>{r.outcome}</Badge>
                  </td>
                  <td className={`${tdCls} text-xs`}>{r.changedFields.length > 0 ? r.changedFields.join(", ") : "\u{2014}"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      )}

      <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}
