"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { deleteApplication } from "@/features/careers/application-actions";
import { secondaryButtonCls } from "./ui";

/** Two-step delete: the first click asks, naming that the CV is removed too. */
export function ApplicationDeleteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteApplication, null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state?.ok) router.replace("/admin/applications");
  }, [state, router]);

  if (!confirming) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => setConfirming(true)} className={secondaryButtonCls}>
          Delete application
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 grid gap-3 border border-destructive bg-white p-4 text-sm">
      <input type="hidden" name="id" value={applicationId} />
      <p id="application-delete-warning" className="font-medium">
        Delete this application permanently? The candidate&apos;s details and the uploaded CV are removed too. This cannot
        be undone.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-describedby="application-delete-warning"
          className="inline-flex min-h-10 items-center justify-center border border-destructive bg-destructive px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Deleting\u{2026}" : "Yes, delete application and CV"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={secondaryButtonCls}>
          Cancel
        </button>
      </div>
      <p aria-live="polite" className="text-sm">
        {state && !state.ok ? <span className="font-medium text-destructive">{state.message}</span> : null}
      </p>
    </form>
  );
}
