"use client";

import { useActionState } from "react";
import { setApplicationStatus } from "@/features/careers/application-actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/features/careers/application-status";
import { buttonCls, inputCls, labelCls } from "./ui";

export function ApplicationStatusForm({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) {
  const [state, action, pending] = useActionState(setApplicationStatus, null);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={applicationId} />
      <input type="hidden" name="from" value={status} />
      <div className="w-full min-w-0 sm:w-64">
        <label htmlFor="application-status-select" className={labelCls}>
          Status
        </label>
        <select id="application-status-select" name="status" defaultValue={status} key={status} className={inputCls}>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
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
