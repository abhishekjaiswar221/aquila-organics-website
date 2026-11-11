"use client";

import { useActionState, useState } from "react";
import {
  createAdminUser,
  submitUserDisabled,
  submitUserReset,
  submitUserRole,
  type UserFormState,
} from "@/features/users/actions";
import type { UserRow } from "@/features/users/queries";
import { Badge, buttonCls, inputCls, labelCls, secondaryButtonCls, TableScroller, tdCls, thCls, Timestamp } from "./ui";

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "ADMINISTRATOR", label: "Administrator" },
  { value: "SALES_MANAGER", label: "Sales manager" },
  { value: "CONTENT_EDITOR", label: "Content editor" },
] as const;

// One state for the whole page, so a one-time password is replaced (and so
// cleared) the moment any other action runs.
async function dispatch(prev: UserFormState, formData: FormData): Promise<UserFormState> {
  switch (formData.get("intent")) {
    case "create":
      return createAdminUser(prev, formData);
    case "role":
      return submitUserRole(prev, formData);
    case "disabled":
      return submitUserDisabled(prev, formData);
    case "reset":
      return submitUserReset(prev, formData);
    default:
      return { ok: false, message: "That action is not valid." };
  }
}

export function UserManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [state, action, pending] = useActionState(dispatch, null);
  const [dismissed, setDismissed] = useState<UserFormState>(null);
  const errors = state && !state.ok ? state.errors : undefined;
  const showSecret = state?.ok === true && state.password !== undefined && state !== dismissed;

  return (
    <div className="mt-6">
      <p aria-live="polite" className="min-h-6 text-sm">
        {state?.message ? <span className={state.ok ? "text-olive-deep" : "font-medium text-destructive"}>{state.message}</span> : null}
      </p>

      {showSecret && state?.ok ? (
        <section aria-labelledby="one-time-heading" className="mt-2 max-w-2xl border-2 border-bronze-text bg-white p-4">
          <h2 id="one-time-heading" className="font-sans text-sm font-semibold uppercase tracking-[0.1em]">
            One-time password
          </h2>
          <p className="mt-1 text-sm font-medium text-destructive">Shown once. Copy it now.</p>
          <p className="mt-2 text-sm">
            Sign-in for <span className="break-all font-medium">{state.email}</span>. They must choose a new password at first
            sign-in.
          </p>
          <p className="mt-2">
            <code className="block break-all border border-charcoal/30 bg-cream px-3 py-2 font-mono text-base select-all">
              {state.password}
            </code>
          </p>
          <button type="button" onClick={() => setDismissed(state)} className={`${secondaryButtonCls} mt-3`}>
            I have copied it
          </button>
        </section>
      ) : null}

      <form action={action} className="mt-4 grid max-w-2xl gap-4 border border-charcoal/20 bg-white p-4 sm:grid-cols-2">
        <input type="hidden" name="intent" value="create" />
        <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.1em] sm:col-span-2">Add a user</h2>
        <div>
          <label htmlFor="user-new-name" className={labelCls}>
            Name
          </label>
          <input id="user-new-name" name="name" maxLength={100} required autoComplete="off" className={inputCls} aria-invalid={errors?.name ? true : undefined} aria-describedby={errors?.name ? "user-new-name-error" : undefined} />
          {errors?.name ? <p id="user-new-name-error" className="mt-1 text-sm font-medium text-destructive">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="user-new-email" className={labelCls}>
            Email
          </label>
          <input id="user-new-email" name="email" type="email" maxLength={254} required autoComplete="off" className={inputCls} aria-invalid={errors?.email ? true : undefined} aria-describedby={errors?.email ? "user-new-email-error" : undefined} />
          {errors?.email ? <p id="user-new-email-error" className="mt-1 text-sm font-medium text-destructive">{errors.email}</p> : null}
        </div>
        <div>
          <label htmlFor="user-new-role" className={labelCls}>
            Role
          </label>
          <select id="user-new-role" name="role" defaultValue="CONTENT_EDITOR" className={inputCls} aria-invalid={errors?.role ? true : undefined}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors?.role ? <p className="mt-1 text-sm font-medium text-destructive">{errors.role}</p> : null}
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className={buttonCls}>
            Create user
          </button>
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          A one-time password is generated and shown once. The user must change it at first sign-in.
        </p>
      </form>

      <TableScroller label="Users">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">Admin users</caption>
          <thead>
            <tr>
              <th scope="col" className={thCls}>User</th>
              <th scope="col" className={thCls}>Role</th>
              <th scope="col" className={thCls}>Status</th>
              <th scope="col" className={thCls}>Created</th>
              <th scope="col" className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <th scope="row" className={`${tdCls} text-left font-medium`}>
                    <span className="block">{u.name}</span>
                    <span className="block break-all text-xs font-normal text-muted-foreground">{u.email}</span>
                    {self ? <span className="text-xs font-normal text-muted-foreground">(you)</span> : null}
                  </th>
                  <td className={tdCls}>
                    <form action={action} className="flex items-center gap-2">
                      <input type="hidden" name="intent" value="role" />
                      <input type="hidden" name="id" value={u.id} />
                      <label htmlFor={`role-${u.id}`} className="sr-only">
                        Role for {u.name}
                      </label>
                      <select id={`role-${u.id}`} name="role" defaultValue={u.role} disabled={self || pending} className={`${inputCls} h-9 w-auto`}>
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" disabled={self || pending} className={secondaryButtonCls}>
                        Save role<span className="sr-only"> for {u.name}</span>
                      </button>
                    </form>
                  </td>
                  <td className={tdCls}>
                    <Badge value={u.disabled ? "ARCHIVED" : "PUBLISHED"}>{u.disabled ? "Disabled" : "Active"}</Badge>
                    {u.mustChangePassword ? <span className="mt-1 block text-xs text-muted-foreground">Must change password</span> : null}
                  </td>
                  <td className={tdCls}>
                    <Timestamp value={u.createdAt} />
                  </td>
                  <td className={tdCls}>
                    <div className="flex flex-wrap gap-2">
                      <form action={action}>
                        <input type="hidden" name="intent" value="disabled" />
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="disabled" value={u.disabled ? "false" : "true"} />
                        <button type="submit" disabled={(self && !u.disabled) || pending} className={secondaryButtonCls}>
                          {u.disabled ? "Enable" : "Disable"}
                          <span className="sr-only"> {u.name}</span>
                        </button>
                      </form>
                      <form action={action}>
                        <input type="hidden" name="intent" value="reset" />
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" disabled={pending} className={secondaryButtonCls}>
                          Reset password<span className="sr-only"> for {u.name}</span>
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
