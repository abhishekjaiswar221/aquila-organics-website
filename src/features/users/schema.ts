import { z } from "zod";
import { ADMIN_ROLES, type AdminRole } from "@/lib/access";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

export const USER_NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const PASSWORD_MAX = 128;

export type UserFieldErrors = Partial<Record<"name" | "email" | "role" | "currentPassword" | "newPassword" | "confirm", string>>;

const clean = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const nameSchema = z
  .string({ error: "Enter a name." })
  .transform(clean)
  .pipe(
    z
      .string()
      .min(1, { error: "Enter a name." })
      .max(USER_NAME_MAX, { error: `Use ${USER_NAME_MAX} characters or fewer.` }),
  );

const emailSchema = z
  .string({ error: "Enter an email address." })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .max(EMAIL_MAX, { error: "That email address is too long." })
      .pipe(z.email({ error: "Enter a valid email address." })),
  );

const roleSchema = z.enum(ADMIN_ROLES as [AdminRole, ...AdminRole[]], { error: "Choose a valid role." });

export function parseRole(value: unknown): AdminRole | null {
  const r = roleSchema.safeParse(value);
  return r.success ? r.data : null;
}

function errorsOf(error: z.ZodError): UserFieldErrors {
  const out: UserFieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]) as keyof UserFieldErrors;
    out[key] ??= issue.message;
  }
  return out;
}

export type CreateUserResult =
  | { ok: true; name: string; email: string; role: AdminRole }
  | { ok: false; errors: UserFieldErrors };

export function parseCreateUser(input: { name: unknown; email: unknown; role: unknown }): CreateUserResult {
  const r = z.object({ name: nameSchema, email: emailSchema, role: roleSchema }).safeParse(input);
  return r.success ? { ok: true, ...r.data } : { ok: false, errors: errorsOf(r.error) };
}

export type ChangePasswordResult =
  | { ok: true; currentPassword: string; newPassword: string }
  | { ok: false; errors: UserFieldErrors };

export function parseChangePassword(input: { currentPassword: unknown; newPassword: unknown; confirm: unknown }): ChangePasswordResult {
  const r = z
    .object({
      currentPassword: z.string({ error: "Enter your current password." }).min(1, { error: "Enter your current password." }).max(PASSWORD_MAX),
      newPassword: z
        .string({ error: "Enter a new password." })
        .min(MIN_PASSWORD_LENGTH, { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` })
        .max(PASSWORD_MAX, { error: `Use ${PASSWORD_MAX} characters or fewer.` }),
      confirm: z.string({ error: "Repeat the new password." }),
    })
    .superRefine((v, ctx) => {
      if (v.newPassword === v.currentPassword) {
        ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from the current one." });
      }
      if (v.confirm !== v.newPassword) {
        ctx.addIssue({ code: "custom", path: ["confirm"], message: "The passwords do not match." });
      }
    })
    .safeParse(input);
  return r.success
    ? { ok: true, currentPassword: r.data.currentPassword, newPassword: r.data.newPassword }
    : { ok: false, errors: errorsOf(r.error) };
}
