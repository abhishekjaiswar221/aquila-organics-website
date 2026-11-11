import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

const state = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => state.headers,
  // Better Auth's nextCookies plugin writes the refreshed session cookie here.
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], has: () => false, delete: () => {} }),
}));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { createCredentialUser } = await import("@/lib/admin-seed");
const { auth } = await import("@/lib/auth");
const { adminGate } = await import("@/lib/access");
const { getAdminAccess, requireAdminUser } = await import("@/lib/permissions");
const { changeOwnPassword, createAdminUser, submitUserDisabled, submitUserReset, submitUserRole } = await import(
  "@/features/users/actions"
);
const { listUsers } = await import("@/features/users/queries");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "CONTENT_EDITOR" | "HR_MANAGER";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"];
const cookies = new Map<string, string>();
const ids = new Map<string, string>();
const asCookie = (cookie: string) => {
  state.headers = new Headers({ cookie });
};
const as = (who: string) => asCookie(cookies.get(who) ?? "");
const digestOf = (e: unknown) => (e instanceof Error && "digest" in e ? String(e.digest) : String(e));

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

async function signIn(email: string, password: string): Promise<string> {
  const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  return headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

let counter = 0;
/** A plain user (no forced change) with a known password and a live session. */
async function makeUser(role: Role = "CONTENT_EDITOR") {
  const email = `u${++counter}-${role.toLowerCase()}@example.test`;
  const password = `plain-${counter}-password`;
  const { id } = await createCredentialUser({ email, password, role, name: `User ${counter}` });
  return { id, email, password, cookie: await signIn(email, password) };
}

const sessionCount = (userId: string) => db.session.count({ where: { userId } });

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  await resetDb();
  for (const role of ROLES) {
    const email = `fx-${role.toLowerCase()}@example.test`;
    const { id } = await createCredentialUser({ email, password: `fx-${role}-password`, role });
    ids.set(role, id);
    cookies.set(role, await signIn(email, `fx-${role}-password`));
  }
});

beforeEach(async () => {
  await db.auditLog.deleteMany();
  await db.user.deleteMany({ where: { email: { not: { startsWith: "fx-" } } } });
  as("SUPER_ADMIN");
});

describe("createAdminUser", () => {
  it("still shows the one-time password when only the audit write fails", async () => {
    const audit = await import("@/features/admin/audit");
    const spy = vi.spyOn(db.auditLog, "create").mockRejectedValueOnce(new Error("audit down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createAdminUser(null, fd({ name: "Audit Down", email: "auditdown@example.test", role: "CONTENT_EDITOR" }));
    spy.mockRestore();
    quiet.mockRestore();
    expect(audit.AUDIT_ACTIONS).toContain("user.create");
    expect(result).toMatchObject({ ok: true, email: "auditdown@example.test" });
    if (!result?.ok || !result.password) throw new Error("expected a password");
    expect(await db.user.count({ where: { email: "auditdown@example.test" } })).toBe(1);
  });

  it("creates a user whose one-time password signs in, flagged to change it, with the chosen role", async () => {
    const result = await createAdminUser(null, fd({ name: "  Priya  Shah ", email: " Priya@Example.TEST ", role: "SALES_MANAGER" }));
    expect(result).toMatchObject({ ok: true, email: "priya@example.test" });
    if (!result?.ok || !result.password) throw new Error("expected a password");
    expect(result.password).toHaveLength(20);

    const user = await db.user.findUniqueOrThrow({ where: { email: "priya@example.test" } });
    expect(user).toMatchObject({ name: "Priya Shah", role: "SALES_MANAGER", mustChangePassword: true, disabled: false });
    const account = await db.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.password).not.toContain(result.password);

    const signedIn = await auth.api.signInEmail({ body: { email: "priya@example.test", password: result.password } });
    expect(signedIn.user.id).toBe(user.id);
  });

  it("allows SUPER_ADMIN as a role", async () => {
    expect(await createAdminUser(null, fd({ name: "Boss", email: "boss@example.test", role: "SUPER_ADMIN" }))).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { email: "boss@example.test" } })).role).toBe("SUPER_ADMIN");
  });

  it("returns a field error for a duplicate email, in any letter case", async () => {
    await createAdminUser(null, fd({ name: "A", email: "dup@example.test", role: "CONTENT_EDITOR" }));
    const again = await createAdminUser(null, fd({ name: "B", email: "DUP@example.test", role: "CONTENT_EDITOR" }));
    expect(again).toEqual({ ok: false, errors: { email: "A user with this email already exists." } });
    expect(await db.user.count({ where: { email: "dup@example.test" } })).toBe(1);
  });

  it("refuses a role outside the four admin roles and invalid fields", async () => {
    for (const role of ["HR_MANAGER", "SALES_EXECUTIVE", "ROOT", ""]) {
      const r = await createAdminUser(null, fd({ name: "X", email: "x@example.test", role }));
      expect(r).toMatchObject({ ok: false, errors: { role: expect.any(String) } });
    }
    expect(await createAdminUser(null, fd({ name: " ", email: "not-an-email", role: "CONTENT_EDITOR" }))).toMatchObject({
      ok: false,
      errors: { name: expect.any(String), email: expect.any(String) },
    });
    expect(await db.user.count({ where: { email: "x@example.test" } })).toBe(0);
  });

  it("audits user.create with the id and role only: no email, name or password in any audit row", async () => {
    const r = await createAdminUser(null, fd({ name: "Zainab Quraishi", email: "zainab@example.test", role: "ADMINISTRATOR" }));
    if (!r?.ok || !r.password) throw new Error("expected a password");
    const created = await db.user.findUniqueOrThrow({ where: { email: "zainab@example.test" } });
    await submitUserRole(null, fd({ id: created.id, role: "CONTENT_EDITOR" }));
    await submitUserDisabled(null, fd({ id: created.id, disabled: "true" }));
    await submitUserDisabled(null, fd({ id: created.id, disabled: "false" }));
    const reset = await submitUserReset(null, fd({ id: created.id }));

    const rows = await db.auditLog.findMany({ orderBy: { at: "asc" } });
    expect(rows.map((x) => x.action)).toEqual(["user.create", "user.role", "user.disable", "user.enable", "user.reset-password"]);
    expect(rows.every((x) => x.entityId === created.id && x.entityType === "user" && x.outcome === "ok")).toBe(true);
    expect(rows[0].detail).toEqual({ role: "ADMINISTRATOR" });
    const dump = JSON.stringify(rows).toLowerCase();
    for (const secret of ["zainab", "quraishi", "example.test", r.password.toLowerCase()]) expect(dump).not.toContain(secret);
    if (reset?.ok && reset.password) expect(dump).not.toContain(reset.password.toLowerCase());
  });

  it("lists users without password data", async () => {
    const users = await listUsers();
    expect(users.length).toBeGreaterThanOrEqual(ROLES.length);
    expect(Object.keys(users[0]).sort()).toEqual(["createdAt", "disabled", "email", "id", "mustChangePassword", "name", "role"]);
  });
});

describe("forced password change", () => {
  async function newOneTimeUser() {
    const email = `ft${++counter}@example.test`;
    const r = await createAdminUser(null, fd({ name: "First Timer", email, role: "CONTENT_EDITOR" }));
    if (!r?.ok || !r.password) throw new Error("expected a password");
    return { email, password: r.password, id: (await db.user.findUniqueOrThrow({ where: { email } })).id };
  }

  it("gates a first sign-in to change-password, then clears the flag and revokes other sessions", async () => {
    const u = await newOneTimeUser();
    const first = await signIn(u.email, u.password);
    const second = await signIn(u.email, u.password);

    asCookie(first);
    const session = await auth.api.getSession({ headers: state.headers });
    expect(adminGate(session!.user as { disabled?: boolean; mustChangePassword?: boolean })).toBe("change-password");
    expect(await getAdminAccess(state.headers)).toEqual({ kind: "forbidden" });
    const redirected = await requireAdminUser().catch((e: unknown) => e);
    expect(digestOf(redirected)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/change-password;/);

    const newPassword = "A-brand-new-passphrase-9";
    const wrong = await changeOwnPassword(null, fd({ currentPassword: "not-the-password", newPassword, confirm: newPassword }));
    expect(wrong).toMatchObject({ ok: false, message: expect.any(String) });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).mustChangePassword).toBe(true);
    expect(await sessionCount(u.id)).toBe(2);

    const done = await changeOwnPassword(null, fd({ currentPassword: u.password, newPassword, confirm: newPassword }));
    expect(done).toEqual({ ok: true, message: "Password changed." });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).mustChangePassword).toBe(false);

    asCookie(second);
    expect(await auth.api.getSession({ headers: state.headers })).toBeNull();
    await expect(auth.api.signInEmail({ body: { email: u.email, password: u.password } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: u.email, password: newPassword } })).resolves.toBeTruthy();
    // The password the new one replaced must not appear in any audit row.
    expect(JSON.stringify(await db.auditLog.findMany())).not.toContain(u.password);
  });

  it("validates the new password: too short, same as current, mismatched", async () => {
    const u = await newOneTimeUser();
    asCookie(await signIn(u.email, u.password));
    const long = "A-brand-new-passphrase-9";
    expect(await changeOwnPassword(null, fd({ currentPassword: u.password, newPassword: "short", confirm: "short" }))).toMatchObject({
      ok: false,
      errors: { newPassword: expect.any(String) },
    });
    expect(await changeOwnPassword(null, fd({ currentPassword: u.password, newPassword: u.password, confirm: u.password }))).toMatchObject({
      ok: false,
      errors: { newPassword: expect.any(String) },
    });
    expect(await changeOwnPassword(null, fd({ currentPassword: u.password, newPassword: long, confirm: `${long}x` }))).toMatchObject({
      ok: false,
      errors: { confirm: expect.any(String) },
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).mustChangePassword).toBe(true);
  });

  it("redirects a signed-out caller to login and refuses a disabled user", async () => {
    state.headers = new Headers();
    const out = await changeOwnPassword(null, fd({ currentPassword: "a", newPassword: "b", confirm: "b" })).catch((e: unknown) => e);
    expect(digestOf(out)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);

    const u = await makeUser();
    asCookie(u.cookie);
    await db.user.update({ where: { id: u.id }, data: { disabled: true } });
    const denied = await changeOwnPassword(null, fd({ currentPassword: u.password, newPassword: "Another-long-pass-1", confirm: "Another-long-pass-1" })).catch((e: unknown) => e);
    expect(digestOf(denied)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
  });
});

describe("disable and enable", () => {
  it("deletes the user's sessions, locks them out, and re-enabling allows sign-in again", async () => {
    const u = await makeUser("ADMINISTRATOR");
    await signIn(u.email, u.password);
    expect(await sessionCount(u.id)).toBe(2);
    asCookie(u.cookie);
    expect((await getAdminAccess(state.headers)).kind).toBe("allow");

    as("SUPER_ADMIN");
    expect(await submitUserDisabled(null, fd({ id: u.id, disabled: "true" }))).toMatchObject({ ok: true });
    expect(await sessionCount(u.id)).toBe(0);
    asCookie(u.cookie);
    expect((await getAdminAccess(state.headers)).kind).not.toBe("allow");
    await expect(auth.api.signInEmail({ body: { email: u.email, password: u.password } })).rejects.toThrow();

    as("SUPER_ADMIN");
    expect(await submitUserDisabled(null, fd({ id: u.id, disabled: "false" }))).toMatchObject({ ok: true });
    const cookie = await signIn(u.email, u.password);
    asCookie(cookie);
    expect((await getAdminAccess(state.headers)).kind).toBe("allow");
  });

  it("forbids a disabled user who still holds a live session", async () => {
    const u = await makeUser("ADMINISTRATOR");
    await db.user.update({ where: { id: u.id }, data: { disabled: true } });
    asCookie(u.cookie);
    expect(await getAdminAccess(state.headers)).toEqual({ kind: "forbidden" });
  });

  it("answers an unknown user and a malformed id without changing anything", async () => {
    expect(await submitUserDisabled(null, fd({ id: "00000000-0000-4000-8000-000000000000", disabled: "true" }))).toMatchObject({ ok: false });
    expect(await submitUserDisabled(null, fd({ id: "nope", disabled: "true" }))).toMatchObject({ ok: false });
    const u = await makeUser();
    expect(await submitUserDisabled(null, fd({ id: u.id, disabled: "maybe" }))).toMatchObject({ ok: false });
    expect(await submitUserRole(null, fd({ id: "00000000-0000-4000-8000-000000000000", role: "SALES_MANAGER" }))).toMatchObject({ ok: false });
    expect(await submitUserReset(null, fd({ id: "00000000-0000-4000-8000-000000000000" }))).toMatchObject({ ok: false });
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("role changes", () => {
  it("changes a role and audits it", async () => {
    const u = await makeUser("CONTENT_EDITOR");
    expect(await submitUserRole(null, fd({ id: u.id, role: "SALES_MANAGER" }))).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("SALES_MANAGER");
    expect(await db.auditLog.count({ where: { action: "user.role", entityId: u.id } })).toBe(1);
  });

  it("refuses a role outside the allow-list", async () => {
    const u = await makeUser("CONTENT_EDITOR");
    for (const role of ["HR_MANAGER", "SALES_EXECUTIVE", "ROOT", ""]) {
      expect(await submitUserRole(null, fd({ id: u.id, role }))).toMatchObject({ ok: false });
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("CONTENT_EDITOR");
  });
});

type FormAction = (prev: null, formData: FormData) => Promise<{ ok: boolean } | null>;

/**
 * Runs two actions as two different signed-in users so that BOTH pass the
 * session gate before EITHER writes (a barrier on the session lookup), which is
 * exactly the stale-tab race the in-transaction guard exists for.
 */
async function race(first: [string, FormAction, FormData], second: [string, FormAction, FormData]) {
  const api = auth.api as unknown as { getSession: (...args: unknown[]) => Promise<unknown> };
  const original = api.getSession.bind(api);
  let arrived = 0;
  let release: () => void = () => {};
  const both = new Promise<void>((resolve) => (release = resolve));
  const spy = vi.spyOn(api, "getSession").mockImplementation(async (...args: unknown[]) => {
    const session = await original(...args);
    if (++arrived >= 2) release();
    await both;
    return session;
  });
  try {
    asCookie(first[0]);
    const p1 = first[1](null, first[2]);
    asCookie(second[0]);
    const p2 = second[1](null, second[2]);
    return await Promise.all([p1, p2]);
  } finally {
    spy.mockRestore();
  }
}

describe("last super admin and self guards", () => {
  // Make the fixture super admin a disabled one for these tests, so the only
  // active super admins are the ones each test creates.
  const rootId = () => ids.get("SUPER_ADMIN")!;
  beforeEach(async () => {
    await db.user.update({ where: { id: rootId() }, data: { disabled: true } });
  });
  afterEach(async () => {
    await db.user.updateMany({ where: { role: "SUPER_ADMIN" }, data: { disabled: false } });
    await db.user.update({ where: { id: rootId() }, data: { role: "SUPER_ADMIN", disabled: false } });
  });

  it("refuses to disable or demote yourself", async () => {
    const a = await makeUser("SUPER_ADMIN");
    const b = await makeUser("SUPER_ADMIN");
    asCookie(a.cookie);
    expect(await submitUserDisabled(null, fd({ id: a.id, disabled: "true" }))).toMatchObject({ ok: false });
    expect(await submitUserRole(null, fd({ id: a.id, role: "ADMINISTRATOR" }))).toMatchObject({ ok: false });
    expect(await db.user.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ role: "SUPER_ADMIN", disabled: false });
    expect(await sessionCount(a.id)).toBe(1);
    expect(b.id).not.toBe(a.id);
  });

  it("allows disabling or demoting another super admin while a second one remains", async () => {
    const a = await makeUser("SUPER_ADMIN");
    const b = await makeUser("SUPER_ADMIN");
    const c = await makeUser("SUPER_ADMIN");
    asCookie(a.cookie);
    expect(await submitUserRole(null, fd({ id: b.id, role: "ADMINISTRATOR" }))).toMatchObject({ ok: true });
    expect(await submitUserDisabled(null, fd({ id: c.id, disabled: "true" }))).toMatchObject({ ok: true });
  });

  it("keeps one active super admin when two disable each other at once", async () => {
    const a = await makeUser("SUPER_ADMIN");
    const b = await makeUser("SUPER_ADMIN");
    const results = await race([a.cookie, submitUserDisabled, fd({ id: b.id, disabled: "true" })], [b.cookie, submitUserDisabled, fd({ id: a.id, disabled: "true" })]);
    expect(results.filter((r) => r?.ok).length).toBe(1);
    expect(await db.user.count({ where: { role: "SUPER_ADMIN", disabled: false } })).toBe(1);
  });

  it("keeps one active super admin when two demote each other at once", async () => {
    const a = await makeUser("SUPER_ADMIN");
    const b = await makeUser("SUPER_ADMIN");
    const results = await race([a.cookie, submitUserRole, fd({ id: b.id, role: "CONTENT_EDITOR" })], [b.cookie, submitUserRole, fd({ id: a.id, role: "CONTENT_EDITOR" })]);
    expect(results.filter((r) => r?.ok).length).toBe(1);
    expect(await db.user.count({ where: { role: "SUPER_ADMIN", disabled: false } })).toBe(1);
  });

  it("does not count a disabled super admin as active", async () => {
    const a = await makeUser("SUPER_ADMIN");
    const b = await makeUser("SUPER_ADMIN");
    const gone = await makeUser("SUPER_ADMIN");
    await db.user.update({ where: { id: gone.id }, data: { disabled: true } });
    const results = await race([a.cookie, submitUserDisabled, fd({ id: b.id, disabled: "true" })], [b.cookie, submitUserDisabled, fd({ id: a.id, disabled: "true" })]);
    expect(results.filter((r) => r?.ok).length).toBe(1);
    expect(await db.user.count({ where: { role: "SUPER_ADMIN", disabled: false } })).toBe(1);
  });

  it("rolls the failed change back completely: sessions and audit untouched", async () => {
    const a = await makeUser("SUPER_ADMIN");
    const b = await makeUser("SUPER_ADMIN");
    const [r1, r2] = await race([a.cookie, submitUserDisabled, fd({ id: b.id, disabled: "true" })], [b.cookie, submitUserDisabled, fd({ id: a.id, disabled: "true" })]);
    // r1 ok means a disabled b, so a is the survivor whose own disable was refused.
    const survivor = r1?.ok ? a : b;
    expect(r1?.ok !== r2?.ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: survivor.id } })).disabled).toBe(false);
    expect(await sessionCount(survivor.id)).toBe(1);
    expect(await db.auditLog.count({ where: { action: "user.disable" } })).toBe(1);
  });
});

describe("resetUserPassword", () => {
  it("refuses to reset your own password and leaves the session and password alone", async () => {
    const before = await db.session.count({ where: { userId: ids.get("SUPER_ADMIN") } });
    const r = await submitUserReset(null, fd({ id: ids.get("SUPER_ADMIN") ?? "" }));
    expect(r).toMatchObject({ ok: false });
    expect(await db.session.count({ where: { userId: ids.get("SUPER_ADMIN") } })).toBe(before);
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.get("SUPER_ADMIN") } })).mustChangePassword).toBe(false);
    expect(await db.auditLog.count({ where: { action: "user.reset-password" } })).toBe(0);
  });

  it("returns a new one-time password that signs in, sets the flag and revokes sessions", async () => {
    const u = await makeUser("SALES_MANAGER");
    await signIn(u.email, u.password);
    const r = await submitUserReset(null, fd({ id: u.id }));
    if (!r?.ok || !r.password) throw new Error("expected a password");
    expect(r.password).toHaveLength(20);
    expect(await sessionCount(u.id)).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).mustChangePassword).toBe(true);
    await expect(auth.api.signInEmail({ body: { email: u.email, password: u.password } })).rejects.toThrow();
    const cookie = await signIn(u.email, r.password);
    asCookie(cookie);
    const session = await auth.api.getSession({ headers: state.headers });
    expect(adminGate(session!.user as { mustChangePassword?: boolean })).toBe("change-password");
    expect(await db.auditLog.count({ where: { action: "user.reset-password", entityId: u.id } })).toBe(1);
  });

  it("gives a different password each time", async () => {
    const u = await makeUser();
    const a = await submitUserReset(null, fd({ id: u.id }));
    const b = await submitUserReset(null, fd({ id: u.id }));
    expect(a?.ok && b?.ok && a.password !== b.password).toBe(true);
  });
});

describe("authorisation", () => {
  const target = async () => (await makeUser("CONTENT_EDITOR")).id;
  const calls: [string, (id: string) => Promise<unknown>][] = [
    ["createAdminUser", () => createAdminUser(null, fd({ name: "N", email: "never@example.test", role: "CONTENT_EDITOR" }))],
    ["submitUserRole", (id) => submitUserRole(null, fd({ id, role: "SALES_MANAGER" }))],
    ["submitUserDisabled", (id) => submitUserDisabled(null, fd({ id, disabled: "true" }))],
    ["submitUserReset", (id) => submitUserReset(null, fd({ id }))],
  ];

  describe.each(["ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"])("as %s", (role) => {
    it.each(calls)("refuses %s with 403 and changes nothing", async (_name, call) => {
      const id = await target();
      const before = await db.user.findUniqueOrThrow({ where: { id } });
      const sessions = await sessionCount(id);
      as(role);
      const error = await call(id).catch((e: unknown) => e);
      expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
      expect(await db.user.findUniqueOrThrow({ where: { id } })).toEqual(before);
      expect(await sessionCount(id)).toBe(sessions);
      expect(await db.user.count({ where: { email: "never@example.test" } })).toBe(0);
      expect(await db.auditLog.count()).toBe(0);
    });
  });

  it.each(calls)("redirects %s to login when signed out", async (_name, call) => {
    const id = await target();
    state.headers = new Headers();
    const error = await call(id).catch((e: unknown) => e);
    expect(digestOf(error)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);
    expect(await db.auditLog.count()).toBe(0);
  });
});
