import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./setup";

// The only mock: there is no Next.js request scope in Vitest, so `headers()`
// is replaced with one that returns the headers each test sets up. The real
// `redirect()`/`forbidden()` from next/navigation run unmocked.
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => requestHeaders.current,
}));

import { auth } from "@/lib/auth";
import { createCredentialUser, seedAdmin } from "@/lib/admin-seed";
import { requireAction, requireRole } from "@/lib/permissions";

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "../..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

const ADMIN_EMAIL = "seed.admin@example.test";
const ADMIN_PASSWORD = "correct-horse-battery-staple";

function runSeed(env: Record<string, string>) {
  return execFileAsync(process.execPath, [tsxCli, "scripts/seed-admin.ts"], {
    cwd: root,
    env: { ...process.env, ...env },
  });
}

function authRequest(pathname: string, body: unknown, ip: string): Promise<Response> {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

async function sessionHeadersFor(email: string, password: string): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

function digestOf(error: unknown): string {
  return error instanceof Error && "digest" in error ? String(error.digest) : String(error);
}

describe("seed:admin", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("refuses a password shorter than 12 characters and never prints it", async () => {
    const short = "Short-pw-11";
    const error = await runSeed({ ADMIN_EMAIL, ADMIN_PASSWORD: short }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 1 });
    const output = `${(error as { stdout: string }).stdout}${(error as { stderr: string }).stderr}`;
    expect(output).toMatch(/at least 12 characters/);
    expect(output).not.toContain(short);
    expect(await db.user.count()).toBe(0);
  });

  it("run twice leaves exactly one SUPER_ADMIN with a credential account", async () => {
    const first = await runSeed({ ADMIN_EMAIL, ADMIN_PASSWORD });
    expect(first.stdout).toMatch(/created/i);
    const second = await runSeed({ ADMIN_EMAIL, ADMIN_PASSWORD: "a-different-password-123" });
    expect(second.stdout).toMatch(/already exists/i);
    for (const out of [first, second]) {
      expect(out.stdout + out.stderr).not.toContain(ADMIN_PASSWORD);
    }

    const users = await db.user.findMany({ include: { accounts: true } });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: ADMIN_EMAIL, role: "SUPER_ADMIN" });
    expect(users[0].accounts).toHaveLength(1);
    expect(users[0].accounts[0]).toMatchObject({ providerId: "credential", accountId: users[0].id });
    expect(users[0].accounts[0].password).not.toContain(ADMIN_PASSWORD);
  });

  it("signs in with the seeded credentials (second run did not reset the password)", async () => {
    const res = await authRequest(
      "/sign-in/email",
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      "203.0.113.10",
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/session_token=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    const body = (await res.json()) as { user: { role: string } };
    expect(body.user.role).toBe("SUPER_ADMIN");
  });

  it("rejects a wrong password", async () => {
    const wrong = await authRequest(
      "/sign-in/email",
      { email: ADMIN_EMAIL, password: "a-different-password-123" },
      "203.0.113.11",
    );
    expect(wrong.status).toBe(401);
    expect(wrong.headers.getSetCookie()).toHaveLength(0);
  });
});

describe("seedAdmin options", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("promotes an existing user and only resets the password when asked", async () => {
    await createCredentialUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "CONTENT_EDITOR" });
    const newPassword = "brand-new-passphrase-456";

    expect(await seedAdmin({ email: ADMIN_EMAIL, password: newPassword })).toEqual({
      created: false,
      promoted: true,
      passwordSet: false,
    });
    await expect(sessionHeadersFor(ADMIN_EMAIL, newPassword)).rejects.toThrow();

    expect(
      await seedAdmin({ email: ADMIN_EMAIL.toUpperCase(), password: newPassword, resetPassword: true }),
    ).toEqual({ created: false, promoted: false, passwordSet: true });
    await expect(sessionHeadersFor(ADMIN_EMAIL, newPassword)).resolves.toBeInstanceOf(Headers);
    await expect(sessionHeadersFor(ADMIN_EMAIL, ADMIN_PASSWORD)).rejects.toThrow();
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(1);
  });
});

describe("public sign-up and role input", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects the public sign-up endpoint", async () => {
    const res = await authRequest(
      "/sign-up/email",
      { name: "Mallory", email: "mallory@example.test", password: "mallory-password-123", role: "SUPER_ADMIN" },
      "203.0.113.20",
    );
    // disabledPaths: the route is not served at all.
    expect(res.status).toBe(404);
    expect(await db.user.count()).toBe(0);
  });

  it("refuses the server sign-up API too", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { name: "Mallory", email: "mallory@example.test", password: "mallory-password-123" },
      }),
    ).rejects.toMatchObject({ statusCode: 400, body: { code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" } });
    expect(await db.user.count()).toBe(0);
  });

  it("does not let a signed-in user set their own role", async () => {
    const { id } = await createCredentialUser({
      email: "editor@example.test",
      password: "editor-password-123",
      role: "CONTENT_EDITOR",
    });
    const cookie = (await sessionHeadersFor("editor@example.test", "editor-password-123")).get("cookie");
    const updateUser = (body: unknown) =>
      auth.handler(
        new Request("http://localhost:3000/api/auth/update-user", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": "203.0.113.21",
            cookie: cookie ?? "",
          },
          body: JSON.stringify(body),
        }),
      );

    const escalate = await updateUser({ role: "SUPER_ADMIN" });
    expect(escalate.status).toBe(400);
    expect(await escalate.json()).toMatchObject({ code: "FIELD_NOT_ALLOWED" });

    // Control: the same session can update a permitted field.
    const rename = await updateUser({ name: "Renamed Editor" });
    expect(rename.status).toBe(200);

    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ role: "CONTENT_EDITOR", name: "Renamed Editor" });
  });
});

describe("requireRole and requireAction", () => {
  const ROLE_USERS = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"] as const;
  type TestRole = (typeof ROLE_USERS)[number];

  beforeAll(async () => {
    // Next.js sets this when experimental.authInterrupts is on (next.config.ts).
    process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
    await resetDb();
    for (const role of ROLE_USERS) {
      await createCredentialUser({
        email: `${role.toLowerCase()}@example.test`,
        password: `${role.toLowerCase()}-password`,
        role,
      });
    }
  });

  beforeEach(() => {
    requestHeaders.current = new Headers();
  });

  async function signInAs(role: TestRole) {
    requestHeaders.current = await sessionHeadersFor(
      `${role.toLowerCase()}@example.test`,
      `${role.toLowerCase()}-password`,
    );
  }

  it("redirects to /admin/login when there is no session", async () => {
    const error = await requireRole().catch((e: unknown) => e);
    expect(digestOf(error)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;307;/);
  });

  it("redirects when the session cookie is forged", async () => {
    requestHeaders.current = new Headers({ cookie: "better-auth.session_token=forged.value" });
    const error = await requireRole().catch((e: unknown) => e);
    expect(digestOf(error)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);
  });

  it("rejects an HR_MANAGER session with a 403 (no admin access yet)", async () => {
    await signInAs("HR_MANAGER");
    const error = await requireRole().catch((e: unknown) => e);
    expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
  });

  it.each(["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"] as const)("allows %s", async (role) => {
    await signInAs(role);
    const result = await requireRole();
    const user = await db.user.findUniqueOrThrow({ where: { email: `${role.toLowerCase()}@example.test` } });
    expect(result).toEqual({ userId: user.id, role });
  });

  it("honours a narrowed allow-list", async () => {
    await signInAs("SALES_MANAGER");
    const error = await requireRole(["SUPER_ADMIN"]).catch((e: unknown) => e);
    expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
  });

  // The matrix holds through real sessions: a sample of actions, allowed and denied.
  it.each([
    ["CONTENT_EDITOR", "products.publish", false],
    ["CONTENT_EDITOR", "products.edit", true],
    ["CONTENT_EDITOR", "users.manage", false],
    ["SALES_MANAGER", "users.manage", false],
    ["SALES_MANAGER", "products.publish", true],
    ["ADMINISTRATOR", "products.verify", false],
    ["ADMINISTRATOR", "settings.edit", true],
    ["SUPER_ADMIN", "audit.view", true],
    ["HR_MANAGER", "products.edit", false],
  ] as const)("requireAction: %s / %s -> allowed=%s", async (role, action, allowed) => {
    await signInAs(role);
    if (allowed) {
      await expect(requireAction(action)).resolves.toMatchObject({ role });
    } else {
      const error = await requireAction(action).catch((e: unknown) => e);
      expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    }
  });
});
