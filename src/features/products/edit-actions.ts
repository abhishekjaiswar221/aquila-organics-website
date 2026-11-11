"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/features/admin/audit";
import {
  PUBLIC_PRODUCT_FIELDS,
  STALE_PRODUCT_ERROR,
  changedProductFields,
  parseProductForm,
  type ProductFormData,
  type ProductSnapshot,
} from "@/features/products/form-schema";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin product create and update. Each exported function is a public Server
 * Action endpoint: requireAction() first (outside any try/catch, it throws
 * redirect/forbidden), then validation of the untrusted form. Results carry
 * human messages only. Status, verified and publishedAt are never read from
 * the form: create is always DRAFT and unverified; update changes them only
 * through the re-verification rule below.
 */

export type ProductEditState = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null;

const FIX_FIELDS = "Fix the highlighted fields and try again.";
const NOT_FOUND = "Product not found.";
const FAILED = "The product could not be saved. Try again.";
const SLUG_TAKEN = "That URL slug is already used by another product.";
const CODE_TAKEN = "That product code is already used by another product.";
const CATEGORY_MISSING = "That category no longer exists. Choose another.";

const SORTED = [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;

function errorClass(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

/** True when `err` (or a cause) is a Prisma unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (code === "P2002") return true;
    if (typeof message === "string" && message.includes("Unique constraint")) return true;
    current = cause;
  }
  return false;
}

/** Field errors for a slug/code another product already uses, or a missing category. */
async function conflicts(
  client: Prisma.TransactionClient | typeof db,
  data: ProductFormData,
  excludeId?: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const notSelf = excludeId ? { id: { not: excludeId } } : {};
  if (await client.product.findFirst({ where: { slug: data.slug, ...notSelf }, select: { id: true } })) out.slug = SLUG_TAKEN;
  if (data.code && (await client.product.findFirst({ where: { code: data.code, ...notSelf }, select: { id: true } }))) {
    out.code = CODE_TAKEN;
  }
  if (data.categoryId && !(await client.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) {
    out.categoryId = CATEGORY_MISSING;
  }
  return out;
}

const invalid = (fieldErrors: Record<string, string>): ProductEditState => ({
  ok: false,
  message: FIX_FIELDS,
  fieldErrors,
});

function scalarColumns(data: ProductFormData) {
  return {
    name: data.name,
    slug: data.slug,
    code: data.code,
    casNumber: data.casNumber,
    casNormalized: data.casNormalized,
    categoryId: data.categoryId,
    description: data.description,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    sourceNote: data.sourceNote,
  };
}

async function replaceChildren(tx: Prisma.TransactionClient, productId: string, data: ProductFormData) {
  await tx.productSpecification.deleteMany({ where: { productId } });
  await tx.productApplication.deleteMany({ where: { productId } });
  if (data.specifications.length > 0) {
    await tx.productSpecification.createMany({
      data: data.specifications.map((s, sortOrder) => ({ productId, label: s.label, value: s.value, sortOrder })),
    });
  }
  if (data.applications.length > 0) {
    await tx.productApplication.createMany({
      data: data.applications.map((name, sortOrder) => ({ productId, name, sortOrder })),
    });
  }
}

export async function createProduct(_prev: ProductEditState, formData: FormData): Promise<ProductEditState> {
  const actor = await requireAction("products.edit");
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const data = parsed.data;

  let id: string;
  try {
    const taken = await conflicts(db, data);
    if (Object.keys(taken).length > 0) return invalid(taken);
    id = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...scalarColumns(data), status: "DRAFT", verified: false },
        select: { id: true },
      });
      await replaceChildren(tx, created.id, data);
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "product.create",
          entityType: "product",
          entityId: created.id,
          outcome: "ok",
          changedFields: [
            "name",
            "slug",
            ...(data.code ? ["code"] : []),
            ...(data.casNumber ? ["casNumber"] : []),
            ...(data.categoryId ? ["categoryId"] : []),
            ...(data.description ? ["description"] : []),
            ...(data.seoTitle ? ["seoTitle"] : []),
            ...(data.seoDescription ? ["seoDescription"] : []),
            ...(data.sourceNote ? ["sourceNote"] : []),
            ...(data.specifications.length > 0 ? ["specifications"] : []),
            ...(data.applications.length > 0 ? ["applications"] : []),
          ],
          detail: { specifications: data.specifications.length, applications: data.applications.length },
        },
        tx,
      );
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const taken = await conflicts(db, data).catch(() => ({}));
      if (Object.keys(taken).length > 0) return invalid(taken);
    }
    console.error("[admin] product create failed:", errorClass(err));
    return { ok: false, message: FAILED };
  }
  // redirect() throws: it must stay outside the try/catch.
  redirect(`/admin/products/${id}/edit`);
}

type UpdateOutcome =
  | { kind: "not-found" }
  | { kind: "stale" }
  | { kind: "invalid"; fieldErrors: Record<string, string> }
  | { kind: "unchanged" }
  | { kind: "saved"; reverified: boolean };

export async function updateProduct(_prev: ProductEditState, formData: FormData): Promise<ProductEditState> {
  const actor = await requireAction("products.edit");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };
  const rawStamp = formData.get("updatedAt");
  const expected = typeof rawStamp === "string" ? new Date(rawStamp) : null;
  if (!expected || Number.isNaN(expected.getTime())) return { ok: false, message: STALE_PRODUCT_ERROR };
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const data = parsed.data;

  let outcome: UpdateOutcome;
  try {
    outcome = await db.$transaction(async (tx): Promise<UpdateOutcome> => {
      const current = await tx.product.findUnique({
        where: { id },
        include: { specifications: { orderBy: [...SORTED] }, applications: { orderBy: [...SORTED] } },
      });
      if (!current) return { kind: "not-found" };
      if (current.updatedAt.getTime() !== expected.getTime()) return { kind: "stale" };

      const before: ProductSnapshot = {
        name: current.name,
        slug: current.slug,
        code: current.code,
        casNumber: current.casNumber,
        categoryId: current.categoryId,
        description: current.description,
        seoTitle: current.seoTitle,
        seoDescription: current.seoDescription,
        sourceNote: current.sourceNote,
        specifications: current.specifications.map((s) => ({ label: s.label, value: s.value })),
        applications: current.applications.map((a) => a.name),
      };
      const changed = changedProductFields(before, data);
      if (changed.length === 0) return { kind: "unchanged" };

      const taken = await conflicts(tx, data, id);
      if (Object.keys(taken).length > 0) return { kind: "invalid", fieldErrors: taken };

      // Any change to public content invalidates the verification, whatever the status:
      // otherwise an edited-but-still-"verified" draft or archived product could later be
      // published by someone who never saw the new content. A PUBLISHED product is also
      // taken offline in the same write.
      const unverify = changed.some((f) => PUBLIC_PRODUCT_FIELDS.includes(f));
      const reverify = current.status === "PUBLISHED" && unverify;
      // Compare-and-set on updatedAt: a concurrent save makes this match nothing.
      const { count } = await tx.product.updateMany({
        where: { id, updatedAt: current.updatedAt },
        data: {
          ...scalarColumns(data),
          ...(unverify ? { verified: false } : {}),
          ...(reverify ? { status: "DRAFT" as const, publishedAt: null } : {}),
        },
      });
      if (count === 0) return { kind: "stale" };

      if (changed.includes("specifications") || changed.includes("applications")) {
        await replaceChildren(tx, id, data);
      }
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "product.update",
          entityType: "product",
          entityId: id,
          outcome: "ok",
          changedFields: changed,
          detail: { status: current.status, reverified: reverify },
        },
        tx,
      );
      if (reverify) {
        await recordAudit(
          {
            actorId: actor.userId,
            actorRole: actor.role,
            action: "product.reverify",
            entityType: "product",
            entityId: id,
            outcome: "ok",
            changedFields: ["status", "verified", "publishedAt"],
            detail: { from: "PUBLISHED", to: "DRAFT", effect: "unpublished for re-verification" },
          },
          tx,
        );
      }
      return { kind: "saved", reverified: reverify };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const taken = await conflicts(db, data, id).catch(() => ({}));
      if (Object.keys(taken).length > 0) return invalid(taken);
    }
    console.error("[admin] product update failed:", errorClass(err));
    return { ok: false, message: FAILED };
  }

  switch (outcome.kind) {
    case "not-found":
      return { ok: false, message: NOT_FOUND };
    case "stale":
      return { ok: false, message: STALE_PRODUCT_ERROR };
    case "invalid":
      return invalid(outcome.fieldErrors);
    case "unchanged":
      return { ok: true, message: "No changes to save." };
    case "saved":
      refresh();
      return {
        ok: true,
        message: outcome.reverified
          ? "Saved. The product is now a draft and must be verified again before it can be published."
          : "Saved.",
      };
  }
}
