import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeCas } from "@/lib/cas";
import { assignUniqueSlugs, productInputSchema, slugify, type ProductInput } from "./schema";

export const VERIFIED_SKIP_REASON = "verified product, not overwritten";

export type ImportResult = {
  created: number;
  updated: number;
  skipped: { index: number; reason: string }[];
};

function describeError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "P2002") return "Duplicate value (slug or code already in use)";
  return error instanceof Error ? error.message.split("\n").pop()?.trim() || "Database error" : "Database error";
}

/**
 * Upserts products by slug. New rows are always DRAFT and unverified; existing
 * rows keep their status, verified flag and publishedAt, so re-importing never
 * publishes or un-publishes anything. Invalid rows are skipped and reported.
 */
export async function importProducts(rows: unknown[], db: PrismaClient): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: [] };

  const valid: { index: number; data: ProductInput }[] = [];
  rows.forEach((row, index) => {
    const parsed = productInputSchema.safeParse(row);
    if (parsed.success) {
      valid.push({ index, data: parsed.data });
    } else {
      const reason = parsed.error.issues
        .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
      result.skipped.push({ index, reason });
    }
  });

  const slugs = assignUniqueSlugs(valid.map((v) => v.data.slug));

  for (const [i, { index, data }] of valid.entries()) {
    const slug = slugs[i] ?? data.slug;
    try {
      const outcome = await importOne(db, { ...data, slug });
      if (outcome === "skipped") result.skipped.push({ index, reason: VERIFIED_SKIP_REASON });
      else result[outcome] += 1;
    } catch (error) {
      result.skipped.push({ index, reason: describeError(error) });
    }
  }

  result.skipped.sort((a, b) => a.index - b.index);
  return result;
}

async function importOne(db: PrismaClient, data: ProductInput): Promise<"created" | "updated" | "skipped"> {
  const casNormalized = data.casNumber ? normalizeCas(data.casNumber) : undefined;

  return db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { slug: data.slug },
      select: { id: true, verified: true },
    });
    // A verified product is never overwritten (its CAS may have been checked by hand).
    if (existing?.verified) return "skipped";

    let categoryId: string | undefined;
    if (data.category) {
      const slug = slugify(data.category);
      if (!slug) throw new Error("Category name must contain letters or digits");
      const category = await tx.category.upsert({
        where: { slug },
        create: { name: data.category, slug },
        update: {},
      });
      categoryId = category.id;
    }

    // Rows with the same slug as an existing product update that product (upsert
    // by slug). Only fields the row supplies are written, so a blank CAS does NOT
    // clear a stored one; status, verified and
    // publishedAt are never touched for an existing product.
    const fields = {
      name: data.name,
      ...(data.code !== undefined && { code: data.code }),
      ...(data.casNumber !== undefined && { casNumber: data.casNumber, casNormalized }),
      ...(categoryId !== undefined && { categoryId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sourceNote !== undefined && { sourceNote: data.sourceNote }),
    };

    let productId: string;
    if (existing) {
      // The verified:false guard makes check and write atomic: if the product was
      // verified after the read above, nothing is written and the row is skipped.
      const { count } = await tx.product.updateMany({
        where: { id: existing.id, verified: false },
        data: fields,
      });
      if (count === 0) return "skipped";
      productId = existing.id;
    } else {
      productId = (
        await tx.product.create({
          data: { ...fields, slug: data.slug, status: "DRAFT", verified: false },
        })
      ).id;
    }

    if (data.specifications) {
      await tx.productSpecification.deleteMany({ where: { productId } });
      await tx.productSpecification.createMany({
        data: data.specifications.map((s, sortOrder) => ({ productId, ...s, sortOrder })),
      });
    }
    if (data.applications) {
      await tx.productApplication.deleteMany({ where: { productId } });
      await tx.productApplication.createMany({
        data: data.applications.map((name, sortOrder) => ({ productId, name, sortOrder })),
      });
    }
    return existing ? "updated" : "created";
  });
}
