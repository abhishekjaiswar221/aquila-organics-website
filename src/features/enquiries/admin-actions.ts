"use server";

import { refresh } from "next/cache";
import type { EnquiryStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS, isEnquiryStatus } from "@/features/enquiries/status";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin enquiry actions. Each exported function is a public Server Action
 * endpoint: requireRole() first (outside try/catch), then input validation.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };
export type EnquiryFormState = { ok: boolean; message: string } | null;

const NOT_FOUND = "Enquiry not found.";
const CONFLICT = "The status was changed by someone else meanwhile. Reload the page and try again.";

class StatusConflict extends Error {}

/**
 * Changes the status and appends one `status.changed` activity ({from, to},
 * actorId = the signed-in user) in one transaction. Setting the current status
 * again is a no-op that writes nothing.
 */
export async function setEnquiryStatus(enquiryId: string, status: EnquiryStatus): Promise<ActionResult> {
  const actor = await requireAction("enquiries.update");
  const id = normalizeUuid(enquiryId);
  if (!id) return { ok: false, error: "That enquiry reference is not valid." };
  if (!isEnquiryStatus(status)) return { ok: false, error: "That status is not valid." };

  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.enquiry.findUnique({ where: { id }, select: { status: true } });
      if (!current) return { ok: false, error: NOT_FOUND } as const;
      if (current.status === status) return { ok: true } as const;
      // Compare-and-set: a concurrent change makes this update match nothing.
      const { count } = await tx.enquiry.updateMany({ where: { id, status: current.status }, data: { status } });
      if (count !== 1) throw new StatusConflict();
      await tx.enquiryActivity.create({
        data: { enquiryId: id, actorId: actor.userId, action: "status.changed", detail: { from: current.status, to: status } },
      });
      return { ok: true } as const;
    });
  } catch (err) {
    if (err instanceof StatusConflict) return { ok: false, error: CONFLICT };
    console.error("[admin] enquiry status change failed:", err instanceof Error ? err.name : typeof err);
    return { ok: false, error: "The change could not be saved. Try again." };
  }
}

/** `useActionState` form wrapper for setEnquiryStatus (fields: enquiryId, status). */
export async function submitEnquiryStatus(_prev: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  await requireAction("enquiries.update");
  const status = formData.get("status");
  if (!isEnquiryStatus(status)) return { ok: false, message: "Choose a status." };
  const result = await setEnquiryStatus(String(formData.get("enquiryId") ?? ""), status);
  if (!result.ok) return { ok: false, message: result.error };
  refresh();
  return { ok: true, message: `Status saved: ${STATUS_LABELS[status]}.` };
}
