import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { classifyQuery } from '@/lib/search'

export const PAGE_SIZE = 24

export type CatalogueSort = 'name-asc' | 'name-desc' | 'newest'

export type CatalogueParams = {
  q?: string
  category?: string
  sort?: CatalogueSort
  page?: number
}

export type ProductListItem = {
  id: string
  slug: string
  name: string
  code: string | null
  casNumber: string | null
  categoryName: string | null
}

export type ProductDetail = ProductListItem & {
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  publishedAt: Date | null
  category: { slug: string; name: string } | null
  specifications: { id: string; label: string; value: string; sortOrder: number }[]
  applications: { id: string; name: string }[]
  documents: { id: string; kind: 'DATASHEET' | 'SDS' | 'OTHER'; title: string; mimeType: string }[]
}

export type CategoryFacet = { slug: string; name: string; count: number }

export type CatalogueResult = {
  items: ProductListItem[]
  total: number
  page: number
  pageCount: number
  categories: CategoryFacet[]
}

/**
 * The single visibility rule: every query in this module goes through it, so a
 * draft or archived product cannot leak through any path.
 */
const PUBLIC: Prisma.ProductWhereInput = { status: 'PUBLISHED' }

const listSelect = {
  id: true,
  slug: true,
  name: true,
  code: true,
  casNumber: true,
  category: { select: { name: true } },
} satisfies Prisma.ProductSelect

type ListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>

function toListItem(row: ListRow): ProductListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    code: row.code,
    casNumber: row.casNumber,
    categoryName: row.category?.name ?? null,
  }
}

/** Postgres rejects NUL bytes in text parameters. */
function stripNul(value: string): string {
  return value.replace(/\u0000/g, '')
}

/**
 * Escape LIKE metacharacters. Prisma's `contains` binds the value as a
 * parameter but does NOT escape them; Postgres LIKE/ILIKE use backslash as the
 * default escape character.
 */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Filter for the user's search text; always bound as parameters. */
function searchWhere(q: string | undefined): Prisma.ProductWhereInput {
  const query = classifyQuery(stripNul(q ?? ''))
  switch (query.kind) {
    case 'empty':
      return {}
    case 'cas':
      return { casNormalized: query.casNormalized }
    case 'text': {
      const needle = escapeLike(query.text)
      return {
        OR: [
          { name: { contains: needle, mode: 'insensitive' } },
          { code: { contains: needle, mode: 'insensitive' } },
        ],
      }
    }
  }
}

function orderFor(sort: string | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'name-desc':
      return [{ name: 'desc' }, { slug: 'desc' }]
    case 'newest':
      return [{ publishedAt: 'desc' }, { name: 'asc' }, { slug: 'asc' }]
    default:
      return [{ name: 'asc' }, { slug: 'asc' }]
  }
}

function normalizePage(page: number | undefined): number {
  if (typeof page !== 'number' || !Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}

export async function searchProducts(params: CatalogueParams): Promise<CatalogueResult> {
  const page = normalizePage(params.page)
  const search = searchWhere(params.q)
  const categorySlug = params.category ? stripNul(params.category) : undefined

  const facetWhere: Prisma.ProductWhereInput = { AND: [PUBLIC, search] }
  const listWhere: Prisma.ProductWhereInput = categorySlug
    ? { AND: [PUBLIC, search, { category: { slug: categorySlug } }] }
    : facetWhere

  const [total, rows, grouped] = await Promise.all([
    db.product.count({ where: listWhere }),
    db.product.findMany({
      where: listWhere,
      select: listSelect,
      orderBy: orderFor(params.sort),
      skip: Math.min((page - 1) * PAGE_SIZE, Number.MAX_SAFE_INTEGER),
      take: PAGE_SIZE,
    }),
    db.product.groupBy({
      by: ['categoryId'],
      where: { AND: [facetWhere, { categoryId: { not: null } }] },
      _count: { _all: true },
    }),
  ])

  const counts = new Map<string, number>()
  for (const g of grouped) {
    if (g.categoryId) counts.set(g.categoryId, g._count._all)
  }
  const cats =
    counts.size === 0
      ? []
      : await db.category.findMany({
          where: { id: { in: [...counts.keys()] } },
          select: { id: true, slug: true, name: true },
          orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        })

  return {
    items: rows.map(toListItem),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    categories: cats.map((c) => ({ slug: c.slug, name: c.name, count: counts.get(c.id) ?? 0 })),
  }
}

export async function getPublishedProduct(slug: string): Promise<ProductDetail | null> {
  const row = await db.product.findFirst({
    where: { AND: [PUBLIC, { slug: stripNul(slug) }] },
    select: {
      ...listSelect,
      description: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      category: { select: { slug: true, name: true } },
      specifications: {
        select: { id: true, label: true, value: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }, { id: 'asc' }],
      },
      applications: {
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      },
      documents: {
        select: { id: true, kind: true, title: true, mimeType: true },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
      },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    code: row.code,
    casNumber: row.casNumber,
    categoryName: row.category?.name ?? null,
    description: row.description,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt,
    category: row.category ? { slug: row.category.slug, name: row.category.name } : null,
    specifications: row.specifications,
    applications: row.applications,
    documents: row.documents,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type EnquirableProduct ={ id: string; name: string; casNumber: string | null }

/**
 * Published products among `ids` (for RFQ lines and the enquiry list). Ids
 * that are unknown, unpublished or not uuids are simply absent from the result.
 */
export async function getPublishedProductsByIds(ids: readonly string[]): Promise<EnquirableProduct[]> {
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))].filter((id) => UUID.test(id)).slice(0, 100)
  if (unique.length === 0) return []
  return db.product.findMany({
    where: { AND: [PUBLIC, { id: { in: unique } }] },
    select: { id: true, name: true, casNumber: true },
  })
}

export async function getRelatedProducts(
  productId: string,
  limit: number,
): Promise<ProductListItem[]> {
  const take = Number.isFinite(limit) ? Math.min(12, Math.max(1, Math.floor(limit))) : 1
  const self = await db.product
    .findFirst({
      where: { AND: [PUBLIC, { id: productId }] },
      select: { categoryId: true },
    })
    .catch(() => null)
  if (!self?.categoryId) return []
  const rows = await db.product.findMany({
    where: { AND: [PUBLIC, { categoryId: self.categoryId }, { id: { not: productId } }] },
    select: listSelect,
    orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    take,
  })
  return rows.map(toListItem)
}
