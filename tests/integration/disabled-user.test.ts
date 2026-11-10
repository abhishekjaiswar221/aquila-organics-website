import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => requestHeaders.current,
}));

import { adminGate } from "@/lib/access";
import { createCredentialUser } from "@/lib/admin-seed";
import { auth } from "@/lib/auth";
import { getAdminAccess, requireAdminUser } from "@/lib/permissions";

const EMAIL = "flags@example.test";
const PASSWORD = "flags-test-password-1";

async function signIn(): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, returnHeaders: true });
  return new Headers({ cookie: headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
}

function digestOf(error: unknown): string {
  return String((error as { digest?: unknown } | null)?.digest ?? "");
}

describe("disabled and must-change users", () => {
  beforeAll(() => {
    process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  });

  beforeEach(async () => {
    await resetDb();
    await createCredentialUser({ email: EMAIL, password: PASSWORD, role: "SALES_MANAGER" });
    requestHeaders.current = new Headers();
  });

  it("refuses to sign in a disabled user, even with the right password, and creates no session", async () => {
    await db.user.update({ where: { email: EMAIL }, data: { disabled: true } });
    await expect(auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } })).rejects.toBeDefined();
    expect(await db.session.count()).toBe(0);
  });

  it("stops an existing session working once the user is disabled", async () => {
    const headers = await signIn();
    expect((await getAdminAccess(headers)).kind).toBe("allow");
    await db.user.update({ where: { email: EMAIL }, data: { disabled: true } });
    expect((await getAdminAccess(headers)).kind).toBe("forbidden");
  });

  it("answers forbidden for actions while a one-time password is still in force", async () => {
    const headers = await signIn();
    await db.user.update({ where: { email: EMAIL }, data: { mustChangePassword: true } });
    expect((await getAdminAccess(headers)).kind).toBe("forbidden");
  });

  it("sends a must-change user to the change-password page from the admin shell", async () => {
    requestHeaders.current = await signIn();
    await db.user.update({ where: { email: EMAIL }, data: { mustChangePassword: true } });
    const error = await requireAdminUser().catch((e: unknown) => e);
    expect(digestOf(error)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/change-password;/);
  });

  it("forbids a disabled user in the admin shell instead of showing it", async () => {
    requestHeaders.current = await signIn();
    await db.user.update({ where: { email: EMAIL }, data: { disabled: true } });
    const error = await requireAdminUser().catch((e: unknown) => e);
    expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
  });

  it("new users are enabled and need no password change by default", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user).toMatchObject({ disabled: false, mustChangePassword: false });
  });
});

describe("adminGate", () => {
  it("lets ordinary users through", () => {
    expect(adminGate({})).toBe("ok");
    expect(adminGate({ disabled: false, mustChangePassword: false })).toBe("ok");
  });

  it("shuts out a disabled user before anything else", () => {
    expect(adminGate({ disabled: true, mustChangePassword: true })).toBe("disabled");
  });

  it("holds a must-change user at the change-password page", () => {
    expect(adminGate({ mustChangePassword: true })).toBe("change-password");
  });
});
