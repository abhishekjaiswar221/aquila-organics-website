"use client";

import { useActionState } from "react";
import type { EnquiryStatus } from "@/generated/prisma/enums";
import { submitEnquiryStatus } from "@/features/enquiries/admin-actions";
import { ENQUIRY_STATUSES, STATUS_LABELS } from "@/features/enquiries/status";
import { buttonCls, inputCls, labelCls } from "./ui";

export function EnquiryStatusForm({ enquiryId, status }: { enquiryId: string; status: EnquiryStatus }) {
  const [state, action, pending] = useActionState(submitEnquiryStatus, null);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <div className="w-full min-w-0 sm:w-64">
        <label htmlFor="enquiry-status-select" className={labelCls}>
          Status
        </label>
        <select id="enquiry-status-select" name="status" defaultValue={status} key={status} className={inputCls}>
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? "Saving\u{2026}" : "Save status"}
      </button>
      <p aria-live="polite" className="w-full text-sm">
        {state ? (
          <span className={state.ok ? "text-olive-deep" : "font-medium text-destructive"}>{state.message}</span>
        ) : null}
      </p>
    </form>
  );
}
