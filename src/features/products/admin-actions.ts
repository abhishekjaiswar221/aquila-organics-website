"use server";

import { refresh } from "next/cache";
import type { ProductStatus } from "@/generated/prisma/enums";
import { recordAudit, recordAuditBestEffort, type AuditInput } from "@/features/admin/audit";
import { isProductStatus } from "@/features/products/admin-queries";
import { PUBLISH_REQUIREMENTS_ERROR, isPublishCheckViolation, publishBlockReason } from "@/features/products/publish-guard";
import { db } from "@/lib/db";
import { can, requireAction, requireRole } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin product actions. Every exported function is a public Server Action
 * endpoint, so each one authorises itself with requireRole() first (outside
 * any try/catch: it throws redirect/forbidden), then validates its untrusted
 * arguments. Results carry human messages only, never internal errors.
 *
 * publishedAt: set to now on every move into PUBLISHED (a republish counts as
 * new for "newest" sorting); unpublish and archive keep it as the date of the
 * last publication. The public queries filter on status, so it is inert then.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ProductFormState = { ok: boolean; message: string } | null;

const NOT_FOUND = "Product not found.";
const INVALID_PRODUCT = "That product reference is not valid.";
const INVALID_STATUS = "That status is not valid.";
const NOT_PERMITTED = "Not permitted";
const FAILED = "The change could not be saved. Try again.";

function errorClass(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

export async function setProductStatus(
  productId: string,
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED",
): Promise<ActionResult> {
  const actor = await requireAction("products.publish");
  const id = normalizeUuid(productId);
  if (!id) return { ok: false, error: INVALID_PRODUCT };
  if (!isProductStatus(status)) return { ok: false, error: INVALID_STATUS };

  // Rejected attempts are audited best-effort; the successful change writes its
  // audit row in the same transaction as the change.
  const entry = (outcome: "ok" | "rejected", from?: ProductStatus): AuditInput => ({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "product.status",
    entityType: "product",
    entityId: id,
    outcome,
    changedFields: ["status"],
    detail: { ...(from ? { from } : {}), to: status },
  });

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: { name: true, slug: true, verified: true, status: true },
    });
    if (!product) return { ok: false, error: NOT_FOUND };
    if (product.status === status) return { ok: true };

    if (status === "PUBLISHED") {
      const reason = publishBlockReason(product);
      if (reason) {
        await recordAuditBestEffort(entry("rejected", product.status));
        return { ok: false, error: reason };
      }
      // Conditional write: if the product was unverified meanwhile, nothing
      // changes; the CHECK constraint backs up the name/slug rule.
      const published = await db.$transaction(async (tx) => {
        const { count } = await tx.product.updateMany({
          where: { id, verified: true },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
        if (count === 0) return false;
        await recordAudit(entry("ok", product.status), tx);
        return true;
      });
      if (!published) {
        await recordAuditBestEffort(entry("rejected", product.status));
        return { ok: false, error: PUBLISH_REQUIREMENTS_ERROR };
      }
    } else {
      await db.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: { status } });
        await recordAudit(entry("ok", product.status), tx);
      });
    }
    return { ok: true };
  } catch (err) {
    if (isPublishCheckViolation(err)) {
      await recordAuditBestEffort(entry("rejected"));
      return { ok: false, error: PUBLISH_REQUIREMENTS_ERROR };
    }
    console.error("[admin] product status change failed:", errorClass(err));
    return { ok: false, error: FAILED };
  }
}

/**
 * SUPER_ADMIN only. Marking a PUBLISHED product unverified also returns it to
 * DRAFT in the same statement, because a published product must be verified.
 */
export async function setProductVerified(productId: string, verified: boolean): Promise<ActionResult> {
  const actor = await requireRole();
  const id = normalizeUuid(productId);
  if (!can(actor.role, "products.verify")) {
    await recordAuditBestEffort({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "product.verified",
      entityType: "product",
      entityId: id ?? undefined,
      outcome: "denied",
      detail: typeof verified === "boolean" ? { to: verified } : undefined,
    });
    return { ok: false, error: NOT_PERMITTED };
  }
  if (!id) return { ok: false, error: INVALID_PRODUCT };
  if (typeof verified !== "boolean") return { ok: false, error: "That value is not valid." };

  try {
    const product = await db.product.findUnique({ where: { id }, select: { verified: true, status: true } });
    if (!product) return { ok: false, error: NOT_FOUND };
    if (product.verified === verified) return { ok: true };
    const unpublish = !verified && product.status === "PUBLISHED";
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: unpublish ? { verified, status: "DRAFT" } : { verified },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "product.verified",
          entityType: "product",
          entityId: id,
          outcome: "ok",
          changedFields: unpublish ? ["verified", "status"] : ["verified"],
          detail: { from: product.verified, to: verified, unpublished: unpublish },
        },
        tx,
      );
    });
    return { ok: true };
  } catch (err) {
    console.error("[admin] product verification change failed:", errorClass(err));
    return { ok: false, error: FAILED };
  }
}

const STATUS_DONE: Record<ProductStatus, string> = {
  PUBLISHED: "Published.",
  DRAFT: "Moved to draft.",
  ARCHIVED: "Archived.",
};

/** `useActionState` form wrapper for setProductStatus (fields: productId, status). */
export async function submitProductStatus(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAction("products.publish");
  const status = formData.get("status");
  if (!isProductStatus(status)) return { ok: false, message: INVALID_STATUS };
  const result = await setProductStatus(String(formData.get("productId") ?? ""), status);
  if (!result.ok) return { ok: false, message: result.error };
  refresh();
  return { ok: true, message: STATUS_DONE[status] };
}

/** `useActionState` form wrapper for setProductVerified (fields: productId, verified=true|false). */
export async function submitProductVerified(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireRole();
  const raw = formData.get("verified");
  if (raw !== "true" && raw !== "false") return { ok: false, message: "That value is not valid." };
  const verified = raw === "true";
  const result = await setProductVerified(String(formData.get("productId") ?? ""), verified);
  if (!result.ok) return { ok: false, message: result.error };
  refresh();
  return { ok: true, message: verified ? "Marked verified." : "Marked unverified." };
}
