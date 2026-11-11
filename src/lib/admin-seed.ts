import { z } from "zod";
import type { Role } from "@/lib/access";
import { auth, MIN_PASSWORD_LENGTH } from "@/lib/auth";

export class SeedInputError extends Error {}

// Placeholder values are public (.env.example, docs), so a SUPER_ADMIN created
// with one would have a known password. tests/unit/admin-seed.test.ts reads
// .env.example to keep this list and the file in step.
const PLACEHOLDER_PREFIXES = ["replace-with", "change-me", "changeme"];
const PLACEHOLDER_VALUES = new Set(["replace-with-a-long-passphrase", "change-me"]);

export function isPlaceholderPassword(password: string): boolean {
  const value = password.trim().toLowerCase();
  return PLACEHOLDER_VALUES.has(value) || PLACEHOLDER_PREFIXES.some((p) => value.startsWith(p));
}

const inputSchema = z.object({
  email: z
    .string({ error: "ADMIN_EMAIL is required." })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "ADMIN_EMAIL must be a valid email address." })),
  password: z
    .string({ error: "ADMIN_PASSWORD is required." })
    .min(MIN_PASSWORD_LENGTH, {
      error: `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    })
    .max(128, { error: "ADMIN_PASSWORD must be at most 128 characters." })
    .refine((value) => !isPlaceholderPassword(value), {
      error: "ADMIN_PASSWORD is a placeholder value; choose a real passphrase.",
    }),
});

export function parseSeedInput(input: { email?: string; password?: string }) {
  const result = inputSchema.safeParse(input);
  // Issue messages are ours and never echo the submitted values.
  if (!result.success) throw new SeedInputError(result.error.issues.map((i) => i.message).join(" "));
  return result.data;
}

/**
 * Creates a user with an email+password credential account the same way
 * Better Auth's sign-up does (its own hasher and internal adapter), bypassing
 * the disabled public sign-up route. Throws if the email is already taken.
 */
export async function createCredentialUser(input: {
  email: string;
  password: string;
  role: Role;
  name?: string;
  /** A generated one-time password: the admin forces a change at first sign-in. */
  mustChangePassword?: boolean;
}): Promise<{ id: string }> {
  const { email, password } = parseSeedInput(input);
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const user = await ctx.internalAdapter.createUser(
    {
      email,
      name: input.name ?? email.split("@")[0],
      emailVerified: true,
      role: input.role,
      mustChangePassword: input.mustChangePassword === true,
    },
    { method: "admin" },
  );
  try {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
  } catch (err) {
    // Never leave a user that has no way to sign in.
    await ctx.internalAdapter.deleteUser(user.id).catch(() => {});
    throw err;
  }
  return { id: user.id };
}

export type SeedResult = {
  created: boolean;
  promoted: boolean;
  passwordSet: boolean;
};

/**
 * Idempotent first-admin seed. If no user has this email, creates it as
 * SUPER_ADMIN with the given password. If the user exists:
 * - its password is left untouched unless `resetPassword` is true (or it has
 *   no credential account yet, in which case one is added);
 * - it is promoted to SUPER_ADMIN if it held another role.
 * Re-running with the same input therefore changes nothing.
 */
export async function seedAdmin(input: {
  email?: string;
  password?: string;
  resetPassword?: boolean;
}): Promise<SeedResult> {
  const { email, password } = parseSeedInput(input);
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  if (!existing) {
    await createCredentialUser({ email, password, role: "SUPER_ADMIN", name: "Administrator" });
    return { created: true, promoted: false, passwordSet: true };
  }

  const { user, accounts } = existing;
  let passwordSet = false;
  const credential = accounts.find((a) => a.providerId === "credential");
  if (!credential) {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    passwordSet = true;
  } else if (input.resetPassword) {
    await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(password));
    // A reset password should not leave old sessions signed in.
    await ctx.internalAdapter.deleteUserSessions(user.id);
    passwordSet = true;
  }

  const promoted = (user as { role?: unknown }).role !== "SUPER_ADMIN";
  if (promoted) await ctx.internalAdapter.updateUser(user.id, { role: "SUPER_ADMIN" });
  return { created: false, promoted, passwordSet };
}
