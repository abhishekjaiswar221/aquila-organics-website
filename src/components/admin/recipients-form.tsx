"use client";

import { useActionState } from "react";
import { saveRecipients } from "@/features/settings/actions";
import { buttonCls, inputCls, labelCls } from "./ui";

type Props = { type: string; label: string; recipients: string[]; disabled?: boolean; note?: string };

export function RecipientsForm({ type, label, recipients, disabled = false, note }: Props) {
  const [state, action, pending] = useActionState(saveRecipients, null);
  const id = `recipients-${type.toLowerCase()}`;
  const mine = state && (state.type === undefined || state.type === type) ? state : null;
  return (
    <form action={action} method="post" className="grid gap-2 border-b border-charcoal/10 py-5 last:border-b-0">
      <input type="hidden" name="type" value={type} />
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <textarea
        id={id}
        name="recipients"
        rows={3}
        defaultValue={recipients.join("\n")}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        className={inputCls}
      />
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {note ?? "One address per line, or separated by commas. Leave empty to notify no one."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || disabled} className={buttonCls}>
          {pending ? "Saving\u{2026}" : "Save recipients"}
          <span className="sr-only">: {label}</span>
        </button>
        <p aria-live="polite" className="text-sm">
          {mine ? <span className={mine.ok ? "text-olive-deep" : "font-medium text-destructive"}>{mine.message}</span> : null}
        </p>
      </div>
    </form>
  );
}
