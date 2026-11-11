"use client";

import { useActionState } from "react";
import type { JobStatus } from "@/generated/prisma/enums";
import { deleteJob, setJobStatus, type JobFormState } from "@/features/careers/job-actions";
import { secondaryButtonCls } from "./ui";

type Props = {
  jobId: string;
  jobTitle: string;
  status: JobStatus;
  applicationCount: number;
};

function Message({ state }: { state: JobFormState }) {
  if (!state) return null;
  return <span className={state.ok ? "text-olive-deep" : "font-medium text-destructive"}>{state.message}</span>;
}

/** Row actions for an opening: Publish / Close / Reopen as draft, and Delete for an unused draft. */
export function JobActions({ jobId, jobTitle, status, applicationCount }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(setJobStatus, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteJob, null);
  const pending = statusPending || deletePending;

  const target = (to: JobStatus, label: string) => (
    <form action={statusAction}>
      <input type="hidden" name="id" value={jobId} />
      <input type="hidden" name="status" value={to} />
      <button type="submit" disabled={pending} className={secondaryButtonCls}>
        {label}
        <span className="sr-only">: {jobTitle}</span>
      </button>
    </form>
  );

  return (
    <div className="flex min-w-48 flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {status === "DRAFT" ? target("PUBLISHED", "Publish") : null}
        {status === "CLOSED" ? target("PUBLISHED", "Publish again") : null}
        {status === "PUBLISHED" ? target("CLOSED", "Close") : null}
        {status === "CLOSED" ? target("DRAFT", "Reopen as draft") : null}
        {status === "PUBLISHED" ? target("DRAFT", "Unpublish to draft") : null}
        {status === "DRAFT" && applicationCount === 0 ? (
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!window.confirm("Delete this draft opening permanently?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={jobId} />
            <button type="submit" disabled={pending} className={secondaryButtonCls}>
              Delete
              <span className="sr-only">: {jobTitle}</span>
            </button>
          </form>
        ) : null}
      </div>
      <p aria-live="polite" className="max-w-72 text-xs leading-relaxed">
        <Message state={statusState} />
        {statusState && deleteState ? " " : null}
        <Message state={deleteState} />
      </p>
    </div>
  );
}
