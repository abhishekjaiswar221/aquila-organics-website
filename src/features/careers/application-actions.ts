"use server";

import { refresh } from "next/cache";
import { recordAudit, recordAuditBestEffort } from "@/features/admin/audit";
import { APPLICATION_STATUS_LABELS, isApplicationStatus } from "@/features/careers/application-status";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { getStorage } from "@/lib/storage";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin application actions. Each exported function is a public Server Action
 * endpoint: requireAction() first (outside try/catch), then input validation.
 * Messages are ours; no candidate data goes into audit rows or logs.
 */

export type ApplicationFormState = { ok: boolean; message: string } | null;

const NOT_FOUND = "Application not found.";
const CONFLICT = "The status was changed by someone else meanwhile. Reload the page and try again.";

class StatusConflict extends Error {}

const fail = (message: string): ApplicationFormState => ({ ok: false, message });
const errorClass = (err: unknown) => (err instanceof Error ? err.name : typeof err);

/**
 * Compare-and-set on the status the form was rendered with (`from`): a
 * concurrent change makes the update match nothing and is rejected. Setting
 * the current status again writes nothing.
 */
export async function setApplicationStatus(_prev: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
  const actor = await requireAction("applications.update");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return fail(NOT_FOUND);
  const to = formData.get("status");
  const from = formData.get("from");
  if (!isApplicationStatus(to)) return fail("Choose a status.");
  if (!isApplicationStatus(from)) return fail("The change could not be saved. Reload the page and try again.");

  try {
    const outcome = await db.$transaction(async (tx) => {
      const { count } = await tx.jobApplication.updateMany({ where: { id, status: from }, data: { status: to } });
      if (count !== 1) {
        const exists = await tx.jobApplication.findUnique({ where: { id }, select: { id: true } });
        return exists ? "conflict" : "missing";
      }
      if (from !== to) {
        await recordAudit(
          {
            actorId: actor.userId,
            actorRole: actor.role,
            action: "application.status",
            entityType: "application",
            entityId: id,
            outcome: "ok",
            changedFields: ["status"],
            detail: { from, to },
          },
          tx,
        );
      }
      return "ok";
    });
    if (outcome === "missing") return fail(NOT_FOUND);
    if (outcome === "conflict") throw new StatusConflict();
  } catch (err) {
    if (err instanceof StatusConflict) return fail(CONFLICT);
    console.error("[admin] application status change failed:", errorClass(err));
    return fail("The change could not be saved. Try again.");
  }
  refresh();
  return { ok: true, message: `Status saved: ${APPLICATION_STATUS_LABELS[to]}.` };
}

/**
 * Deletes the application row (its file rows cascade) and writes the audit row
 * in one transaction, then removes the stored objects. A storage failure never
 * resurrects the rows: it is logged by class name and audited.
 */
export async function deleteApplication(_prev: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
  const actor = await requireAction("applications.update");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return fail(NOT_FOUND);

  let keys: string[] | null;
  try {
    keys = await db.$transaction(async (tx) => {
      const app = await tx.jobApplication.findUnique({
        where: { id },
        select: { id: true, files: { select: { storageKey: true } } },
      });
      if (!app) return null;
      await tx.jobApplication.delete({ where: { id } });
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "application.delete",
          entityType: "application",
          entityId: app.id,
          outcome: "ok",
          detail: { files: app.files.length },
        },
        tx,
      );
      return app.files.map((f) => f.storageKey);
    });
  } catch (err) {
    console.error("[admin] application delete failed:", errorClass(err));
    return fail("The application could not be deleted. Try again.");
  }
  if (!keys) return fail(NOT_FOUND);

  const storage = getStorage();
  let storageFailed = false;
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (err) {
      storageFailed = true;
      console.error("[admin] application file removal failed:", errorClass(err));
    }
  }
  if (storageFailed) {
    await recordAuditBestEffort({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "application.delete",
      entityType: "application",
      entityId: id,
      outcome: "ok",
      detail: { storageCleanup: "failed" },
    });
  }
  // No refresh(): it would re-render this (now deleted) application's page as Not found before the form
  // can send the user back to the list.
  return { ok: true, message: "Application deleted." };
}
