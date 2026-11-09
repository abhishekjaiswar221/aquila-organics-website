import Link from "next/link";
import { ProductActions } from "@/components/admin/product-actions";
import {
  Badge,
  PageHeader,
  Pagination,
  TableScroller,
  buttonCls,
  inputCls,
  labelCls,
  linkCls,
  tdCls,
  thCls,
} from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { firstParam, listHref, pageParam } from "@/features/admin/search-params";
import { PRODUCT_STATUSES, isProductStatus, listAdminProducts } from "@/features/products/admin-queries";
import { requireRole } from "@/lib/permissions";

// Per request (session + database), no `use cache`: a change shows at once.
export const instant = false;
export const metadata = adminMetadata("Products");

const PATH = "/admin/products";
const STATUS_LABELS = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" } as const;
const NOTE_LENGTH = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}\u{2026}` : text;
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { role } = await requireRole();
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const rawStatus = firstParam(sp.status);
  const status = isProductStatus(rawStatus) ? rawStatus : undefined;
  const result = await listAdminProducts({ q: q || undefined, status, page: pageParam(sp.page) });
  const canVerify = role === "SUPER_ADMIN";
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader title="Products">
        {result.total} {result.total === 1 ? "product" : "products"}
        {filtered ? " match" : " in the catalogue (all statuses)"}
      </PageHeader>

      <form method="get" action={PATH} className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="product-q" className={labelCls}>
            Search name, code or CAS
          </label>
          <input id="product-q" name="q" type="search" defaultValue={q} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label htmlFor="product-status" className={labelCls}>
            Status
          </label>
          <select id="product-status" name="status" defaultValue={status ?? ""} className={inputCls}>
            <option value="">All statuses</option>
            {PRODUCT_STATUSES.map((s) => (
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

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Only verified products can be published. Publishing makes a product visible in the public catalogue at once;
        unpublishing returns it to draft.
        {canVerify
          ? " As a super admin you can mark products verified. Marking a published product unverified also unpublishes it."
          : " A super admin marks products verified."}
      </p>

      {result.items.length === 0 ? (
        <p className="mt-6 border border-charcoal/20 bg-white p-4 text-sm">
          {filtered ? "No products match these filters." : "There are no products yet."}
        </p>
      ) : (
        <TableScroller label="Products">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <caption className="sr-only">Products, all statuses</caption>
            <thead>
              <tr>
                <th scope="col" className={thCls}>Name</th>
                <th scope="col" className={thCls}>Code</th>
                <th scope="col" className={thCls}>CAS</th>
                <th scope="col" className={thCls}>Category</th>
                <th scope="col" className={thCls}>Status</th>
                <th scope="col" className={thCls}>Verified</th>
                <th scope="col" className={thCls}>Source note</th>
                <th scope="col" className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id} data-testid="product-row">
                  <th scope="row" className={`${tdCls} min-w-48 text-left font-medium`}>
                    {p.status === "PUBLISHED" ? (
                      <Link href={`/aroma-chemicals/${encodeURIComponent(p.slug)}`} className={linkCls}>
                        {p.name || "(no name)"}
                      </Link>
                    ) : (
                      <span>{p.name || "(no name)"}</span>
                    )}
                    <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted-foreground">{p.slug}</span>
                  </th>
                  <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{p.code ?? "\u{2014}"}</td>
                  <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{p.casNumber ?? "\u{2014}"}</td>
                  <td className={tdCls}>{p.categoryName ?? "\u{2014}"}</td>
                  <td className={tdCls}>
                    <Badge value={p.status}>{STATUS_LABELS[p.status]}</Badge>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>{p.verified ? "Verified" : "Not verified"}</td>
                  <td className={`${tdCls} max-w-56 text-xs text-muted-foreground`}>
                    {p.sourceNote ? <span title={p.sourceNote}>{truncate(p.sourceNote, NOTE_LENGTH)}</span> : "\u{2014}"}
                  </td>
                  <td className={tdCls}>
                    <ProductActions
                      productId={p.id}
                      productName={p.name}
                      status={p.status}
                      verified={p.verified}
                      canVerify={canVerify}
                    />
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
