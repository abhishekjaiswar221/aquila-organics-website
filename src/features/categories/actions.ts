"use server";

import { refresh } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { recordAudit, type AuditAction } from "@/features/admin/audit";
import { parseCategoryIntent, parseCategoryName, parseMoveDirection } from "@/features/categories/schema";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

/*
 * One Server Action behind every category form (hidden field `intent`:
 * create | rename | move | delete). Every exported function is a public
 * endpoint: authorise first (outside try/catch), then validate. Messages are
 * ours; names the editor typed are never written to the audit log.
 */

export type CategoryFormState = { ok: boolean; message: string } | null;

const FAILED = "The change could not be saved. Try again.";
const NOT_FOUND = "That category no longer exists.";
const DUPLICATE = "A category with this name already exists.";

class NotFound extends Error {}
class InUse extends Error {
  constructor(readonly count: number) {
    super("in use");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function manageCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const actor = await requireAction("products.edit");
  const intent = parseCategoryIntent(formData.get("intent"));
  if (!intent) return { ok: false, message: "That action is not valid." };

  const audit = (action: AuditAction, entityId: string, changedFields: string[], tx: Prisma.TransactionClient) =>
    recordAudit(
      { actorId: actor.userId, actorRole: actor.role, action, entityType: "category", entityId, outcome: "ok", changedFields },
      tx,
    );

  try {
    if (intent === "create") {
      const name = parseCategoryName(formData.get("name"));
      if (!name.ok) return { ok: false, message: name.error };
      await db.$transaction(async (tx) => {
        const last = await tx.category.aggregate({ _max: { sortOrder: true } });
        const created = await tx.category.create({
          data: { name: name.name, slug: name.slug, sortOrder: (last._max.sortOrder ?? 0) + 1 },
        });
        await audit("category.create", created.id, ["name"], tx);
      });
      refresh();
      return { ok: true, message: "Category added." };
    }

    const id = normalizeUuid(formData.get("id"));
    if (!id) return { ok: false, message: NOT_FOUND };

    if (intent === "rename") {
      const name = parseCategoryName(formData.get("name"));
      if (!name.ok) return { ok: false, message: name.error };
      await db.$transaction(async (tx) => {
        // The slug is NOT changed: it is a stable identifier. Only the display name moves.
        const { count } = await tx.category.updateMany({ where: { id }, data: { name: name.name } });
        if (count === 0) throw new NotFound();
        await audit("category.update", id, ["name"], tx);
      });
      refresh();
      return { ok: true, message: "Category renamed." };
    }

    if (intent === "move") {
      const direction = parseMoveDirection(formData.get("direction"));
      if (!direction) return { ok: false, message: "That action is not valid." };
      await db.$transaction(async (tx) => {
        const rows = await tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
        const from = rows.findIndex((r) => r.id === id);
        if (from < 0) throw new NotFound();
        const to = direction === "up" ? from - 1 : from + 1;
        if (to < 0 || to >= rows.length) return;
        const order = rows.map((r) => r.id);
        [order[from], order[to]] = [order[to], order[from]];
        // Rewrite every position: the default sortOrder is 0 for all, so swapping two would not stick.
        for (const [index, categoryId] of order.entries()) {
          await tx.category.update({ where: { id: categoryId }, data: { sortOrder: index + 1 } });
        }
        await audit("category.update", id, ["sortOrder"], tx);
      });
      refresh();
      return { ok: true, message: "Order updated." };
    }

    // delete: only a category no product uses (the write itself re-checks atomically).
    await db.$transaction(async (tx) => {
      const { count } = await tx.category.deleteMany({ where: { id, products: { none: {} } } });
      if (count === 0) {
        const used = await tx.product.count({ where: { categoryId: id } });
        if (used > 0) throw new InUse(used);
        throw new NotFound();
      }
      await audit("category.delete", id, [], tx);
    });
    refresh();
    return { ok: true, message: "Category deleted." };
  } catch (err) {
    if (err instanceof NotFound) return { ok: false, message: NOT_FOUND };
    if (err instanceof InUse) {
      return { ok: false, message: `${err.count} ${err.count === 1 ? "product uses" : "products use"} this category. Move them first.` };
    }
    if (isUniqueViolation(err)) return { ok: false, message: DUPLICATE };
    console.error("[admin] category change failed:", err instanceof Error ? err.name : typeof err);
    return { ok: false, message: FAILED };
  }
}
