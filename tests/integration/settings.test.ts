import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";
import { db, resetDb } from "./setup";

const state = vi.hoisted(() => ({ root: "", headers: new Headers(), sent: [] as EmailMessage[] }));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("@/lib/storage", async () => {
  const { LocalStorage } = await import("@/lib/storage/local");
  return { getStorage: () => new LocalStorage(state.root) };
});
vi.mock("@/lib/email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...original,
    getEmailProvider: () => ({
      send: async (msg: EmailMessage) => {
        state.sent.push(msg);
      },
    }),
  };
});

const { createCredentialUser } = await import("@/lib/admin-seed");
const { auth } = await import("@/lib/auth");
const { saveRecipients } = await import("@/features/settings/actions");
const { getAllRecipients } = await import("@/features/settings/queries");
const { submitContact } = await import("@/features/contact/actions");

type Role = "SUPER_ADMIN" | "ADMINISTRATOR" | "SALES_MANAGER" | "CONTENT_EDITOR";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"];
const cookies = new Map<Role, string>();
const ids = new Map<Role, string>();
const asRole = (role: Role) => {
  state.headers = new Headers({ cookie: cookies.get(role) ?? "" });
};
const digestOf = (e: unknown) => (e instanceof Error && "digest" in e ? String(e.digest) : String(e));

function recipientsForm(type: string, recipients: string): FormData {
  const fd = new FormData();
  fd.set("type", type);
  fd.set("recipients", recipients);
  return fd;
}

beforeAll(async () => {
  process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-settings-"));
  await resetDb();
  for (const role of ROLES) {
    const email = `settings-${role.toLowerCase()}@example.test`;
    const { id } = await createCredentialUser({ email, password: `settings-${role}-pass`, role });
    ids.set(role, id);
    const { headers } = await auth.api.signInEmail({ body: { email, password: `settings-${role}-pass` }, returnHeaders: true });
    cookies.set(role, headers.getSetCookie().map((c) => c.split(";")[0]).join("; "));
  }
});

beforeEach(async () => {
  await db.siteSetting.deleteMany();
  await db.auditLog.deleteMany();
  state.sent.length = 0;
});

describe("saveRecipients", () => {
  it.each(["SUPER_ADMIN", "ADMINISTRATOR"] as const)("lets %s store a normalised list and audits it without addresses", async (role) => {
    asRole(role);
    const result = await saveRecipients(null, recipientsForm("FLAVOURS", "A@x.com, b@x.com\nA@X.com"));
    expect(result).toMatchObject({ ok: true });
    expect((await getAllRecipients()).FLAVOURS).toEqual(["a@x.com", "b@x.com"]);
    const rows = await db.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "settings.recipients",
      outcome: "ok",
      actorId: ids.get(role),
      entityId: "notification.recipients.FLAVOURS",
      detail: { type: "FLAVOURS", count: 2 },
    });
    expect(JSON.stringify(rows[0])).not.toContain("x.com");
  });

  it("can clear a list", async () => {
    asRole("SUPER_ADMIN");
    await saveRecipients(null, recipientsForm("GENERAL", "a@x.com"));
    const result = await saveRecipients(null, recipientsForm("GENERAL", ""));
    expect(result).toMatchObject({ ok: true });
    expect((await getAllRecipients()).GENERAL).toEqual([]);
  });

  it("rejects bad input and stores nothing", async () => {
    asRole("SUPER_ADMIN");
    const result = await saveRecipients(null, recipientsForm("GENERAL", "ok@x.com, nope"));
    expect(result).toMatchObject({ ok: false, message: "1 entry is not a valid email address." });
    expect(await db.siteSetting.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it.each(["CAREERS", "NOPE", "", "__proto__"])("refuses type %j", async (type) => {
    asRole("SUPER_ADMIN");
    const result = await saveRecipients(null, recipientsForm(type, "a@x.com"));
    expect(result).toMatchObject({ ok: false });
    expect(await db.siteSetting.count()).toBe(0);
  });

  it.each(["SALES_MANAGER", "CONTENT_EDITOR"] as const)("refuses %s with a 403 and writes nothing", async (role) => {
    asRole(role);
    const error = await saveRecipients(null, recipientsForm("GENERAL", "a@x.com")).catch((e: unknown) => e);
    expect(digestOf(error)).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await db.siteSetting.count()).toBe(0);
  });

  it("redirects a signed-out caller to the login page", async () => {
    state.headers = new Headers();
    const error = await saveRecipients(null, recipientsForm("GENERAL", "a@x.com")).catch((e: unknown) => e);
    expect(digestOf(error)).toMatch(/^NEXT_REDIRECT;replace;\/admin\/login;/);
  });

  it("changes where the next enquiry's internal email goes", async () => {
    asRole("ADMINISTRATOR");
    await saveRecipients(null, recipientsForm("GENERAL", "new-inbox@test.example"));
    state.headers = new Headers({ "x-forwarded-for": "203.0.113.77", "user-agent": "TEST-Agent/1.0" });
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      type: "GENERAL",
      fullName: "TEST Jane Buyer",
      companyName: "TEST House Ltd",
      email: "jane@testfragrance.example",
      phone: "+44 20 7946 0000",
      country: "United Kingdom",
      message: "TEST Please call me.",
      consent: "on",
      website: "",
    })) {
      fd.set(k, v);
    }
    await submitContact(fd);
    expect(state.sent.some((m) => m.to.includes("new-inbox@test.example"))).toBe(true);
  });
});
