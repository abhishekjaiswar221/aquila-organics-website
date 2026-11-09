import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { classifyQuery } from "@/lib/search";

/*
 * Admin-only product queries: every status, plus internal fields (verified,
 * sourceNote). Never import these into public pages; callers authorise first
 * with requireRole(). The public catalogue keeps its own PUBLISHED-only module.
 */

export const ADMIN_PRODUCT_PAGE_SIZE = 25;
export const PRODUCT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const satisfies readonly ProductStatus[];

export type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  casNumber: string | null;
  categoryName: string | null;
  status: ProductStatus;
  verified: boolean;
  sourceNote: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type AdminProductFilter = { q?: string; status?: ProductStatus; page?: number };

export type AdminProductList = {
  items: AdminProductRow[];
  total: number;
  page: number;
  pageCount: number;
};

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && (PRODUCT_STATUSES as readonly string[]).includes(value);
}

const stripNul = (s: string) => s.replace(/\u0000/g, "");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function searchWhere(q: string | undefined): Prisma.ProductWhereInput {
  const query = classifyQuery(stripNul(q ?? ""));
  switch (query.kind) {
    case "empty":
      return {};
    case "cas":
      return { casNormalized: query.casNormalized };
    case "text": {
      const needle = escapeLike(query.text);
      return {
        OR: [
          { name: { contains: needle, mode: "insensitive" } },
          { code: { contains: needle, mode: "insensitive" } },
          { casNumber: { contains: needle, mode: "insensitive" } },
        ],
      };
    }
  }
}

export function normalizePage(page: number | undefined): number {
  if (typeof page !== "number" || !Number.isFinite(page)) return 1;
  return Math.min(1_000_000, Math.max(1, Math.floor(page)));
}

export async function listAdminProducts(filter: AdminProductFilter): Promise<AdminProductList> {
  const page = normalizePage(filter.page);
  const where: Prisma.ProductWhereInput = {
    AND: [searchWhere(filter.q), isProductStatus(filter.status) ? { status: filter.status } : {}],
  };
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        code: true,
        casNumber: true,
        status: true,
        verified: true,
        sourceNote: true,
        publishedAt: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
      skip: (page - 1) * ADMIN_PRODUCT_PAGE_SIZE,
      take: ADMIN_PRODUCT_PAGE_SIZE,
    }),
  ]);
  return {
    items: rows.map(({ category, ...row }) => ({ ...row, categoryName: category?.name ?? null })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PRODUCT_PAGE_SIZE)),
  };
}
