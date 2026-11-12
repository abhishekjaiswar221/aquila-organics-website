"use server";

import { recordAudit } from "@/features/admin/audit";
import { parseRecipientsInput, recipientsKey } from "@/features/enquiries/recipients";
import { isRecipientType } from "@/features/settings/queries";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";

/*
 * Every exported function is a public Server Action endpoint: authorise first
 * (outside try/catch), then validate. Messages are ours; nothing typed by the
 * editor (addresses) is echoed back or written to the audit log.
 */

export type SettingsFormState = { ok: boolean; message: string; type?: string } | null;

export async function saveRecipients(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  // The careers notice carries candidate details, so only the people who may see applications
  // (HR manager, super admin) choose who receives it; settings.edit (administrators) must not.
  const type = formData.get("type");
  const actor = await requireAction(type === "CAREERS" ? "applications.update" : "settings.edit");
  if (!isRecipientType(type)) return { ok: false, message: "Choose a valid enquiry type." };
  const raw = formData.get("recipients");
  const parsed = parseRecipientsInput(typeof raw === "string" ? raw : "");
  if (!parsed.ok) return { ok: false, message: parsed.error, type };

  try {
    await db.$transaction(async (tx) => {
      const key = recipientsKey(type);
      await tx.siteSetting.upsert({
        where: { key },
        create: { key, value: parsed.emails },
        update: { value: parsed.emails },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "settings.recipients",
          entityType: "setting",
          entityId: key,
          outcome: "ok",
          changedFields: ["recipients"],
          detail: { type, count: parsed.emails.length },
        },
        tx,
      );
    });
  } catch (err) {
    console.error("[admin] saving recipients failed:", err instanceof Error ? err.name : typeof err);
    return { ok: false, message: "The change could not be saved. Try again.", type };
  }
  return {
    ok: true,
    type,
    message: parsed.emails.length === 0 ? "Saved. No one will be notified for this type." : `Saved. ${parsed.emails.length} recipient(s).`,
  };
}
