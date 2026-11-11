import "server-only";
import type { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin edit read model. Admin-only (includes verified and the source note):
 * callers authorise first with requireAction("products.edit").
 */

export type ProductEditModel = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  casNumber: string | null;
  categoryId: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sourceNote: string | null;
  status: ProductStatus;
  verified: boolean;
  /** ISO string; posted back as the optimistic-concurrency token. */
  updatedAt: string;
  specifications: { label: string; value: string }[];
  applications: string[];
};

export async function getProductForEdit(id: string): Promise<ProductEditModel | null> {
  const uuid = normalizeUuid(id);
  if (!uuid) return null;
  const row = await db.product.findUnique({
    where: { id: uuid },
    include: {
      specifications: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
      applications: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    casNumber: row.casNumber,
    categoryId: row.categoryId,
    description: row.description,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    sourceNote: row.sourceNote,
    status: row.status,
    verified: row.verified,
    updatedAt: row.updatedAt.toISOString(),
    specifications: row.specifications.map((s) => ({ label: s.label, value: s.value })),
    applications: row.applications.map((a) => a.name),
  };
}

export type ProductDocumentRow = { id: string; kind: "DATASHEET" | "SDS" | "OTHER"; title: string };

/** Documents of a product for the admin panel. Never includes the storage key. */
export async function listProductDocuments(productId: string): Promise<ProductDocumentRow[]> {
  return db.productDocument.findMany({
    where: { productId },
    select: { id: true, kind: true, title: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export type CategoryOption ={ id: string; name: string };

/** Existing categories for the form's select (category management lives elsewhere). */
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  return db.category.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
