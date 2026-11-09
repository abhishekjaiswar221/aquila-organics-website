import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";
import { db, resetDb } from "./setup";

// Only the email provider, the storage root and the request headers are faked.
const state = vi.hoisted(() => ({
  root: "",
  headers: new Headers(),
  sent: [] as EmailMessage[],
  failEmail: false,
}));

vi.mock("next/headers", () => ({
  headers: async () => state.headers,
}));

vi.mock("@/lib/storage", async () => {
  const { LocalStorage } = await import("@/lib/storage/local");
  let instance: InstanceType<typeof LocalStorage> | undefined;
  let instanceRoot = "";
  return {
    getStorage: () => {
      if (!instance || instanceRoot !== state.root) {
        instance = new LocalStorage(state.root);
        instanceRoot = state.root;
      }
      return instance;
    },
  };
});

vi.mock("@/lib/email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...original,
    getEmailProvider: () => ({
      send: async (msg: EmailMessage) => {
        if (state.failEmail) throw new Error("SMTP refused for jane@testfragrance.example");
        state.sent.push(msg);
      },
    }),
  };
});

const { submitRfq } = await import("@/features/enquiries/actions");
const { getStorage } = await import("@/lib/storage");
const { hashIp } = await import("@/lib/client-ip");
const { env } = await import("@/lib/env");

const YEAR = new Date().getUTCFullYear();
const UA = `TEST-Agent/1.0 ${"x".repeat(400)}`;
let ipCounter = 0;

function useIp(ip?: string) {
  ipCounter += 1;
  const address = ip ?? `198.51.100.${ipCounter}`;
  state.headers = new Headers({ "x-forwarded-for": address, "user-agent": UA });
  return address;
}

type Line = { productId?: string; name: string; quantity: string; unit: string; notes?: string };

function form(lines: Line[], extra: Record<string, string> = {}, files: File[] = []): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    fullName: "TEST Jane Buyer",
    companyName: "TEST Fragrance House Ltd",
    email: "jane@testfragrance.example",
    phone: "+44 20 7946 0000",
    country: "United Kingdom",
    businessSegment: "FRAGRANCES",
    intendedApplication: "TEST fine fragrance",
    consent: "on",
    website: "",
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  lines.forEach((line, i) => {
    for (const [k, v] of Object.entries(line)) if (v !== undefined) fd.set(`items.${i}.${k}`, v);
  });
  for (const f of files) fd.append("attachments", f);
  return fd;
}

const freeLine = (name = "TEST Custom blend"): Line => ({ name, quantity: "5", unit: "KG" });

const pdf = (name = "TEST-spec.pdf") =>
  new File([new TextEncoder().encode("%PDF-1.4\n% TEST fixture\n%%EOF\n")], name, { type: "application/pdf" });

let seq = 0;
async function makeProduct(name: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED", cas?: string) {
  seq += 1;
  return db.product.create({
    data: {
      name,
      slug: `test-rfq-${seq}`,
      casNumber: cas,
      casNormalized: cas?.replace(/-/g, ""),
      status,
      verified: status === "PUBLISHED",
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
}

async function setRecipients(type: string, value: unknown) {
  await db.siteSetting.create({ data: { key: `notification.recipients.${type}`, value: value as never } });
}

async function storedFiles(): Promise<string[]> {
  try {
    return await readdir(state.root);
  } catch {
    return [];
  }
}

async function expectNothingStored() {
  expect(await db.enquiry.count()).toBe(0);
  expect(await db.enquiryItem.count()).toBe(0);
  expect(await db.enquiryAttachment.count()).toBe(0);
  expect(await db.enquiryActivity.count()).toBe(0);
  expect(await storedFiles()).toEqual([]);
}

const silence = () => ({
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
});

beforeAll(async () => {
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-rfq-"));
});

afterAll(async () => {
  await rm(state.root, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDb();
  await rm(state.root, { recursive: true, force: true });
  state.sent = [];
  state.failEmail = false;
  seq = 0;
  // Every test configures recipients for the type it expects, so the
  // "no recipients" warning is only silenced where it is asserted.
  await setRecipients("AROMA_CHEMICALS", ["sales-aroma@test.example"]);
  await setRecipients("FRAGRANCES", ["sales-fragrance@test.example"]);
  await setRecipients("GENERAL", ["sales@test.example"]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dbRateLimitStore", () => {
  it("counts concurrent increments exactly, per (key, window)", async () => {
    const { dbRateLimitStore } = await import("@/lib/rate-limit-db");
    const window = new Date(Date.UTC(2026, 0, 1, 10));
    const counts = await Promise.all(
      Array.from({ length: 12 }, () => dbRateLimitStore.increment("TEST-key", window)),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(await dbRateLimitStore.increment("TEST-other", window)).toBe(1);
    expect(await dbRateLimitStore.increment("TEST-key", new Date(Date.UTC(2026, 0, 1, 11)))).toBe(1);
    const row = await db.rateLimitHit.findFirstOrThrow({ where: { key: "TEST-key", windowStart: window } });
    expect(row.count).toBe(12);
  });
});

describe("submitRfq", () => {
  it("stores a two-product enquiry with snapshots, one creation activity and a reference", async () => {
    const linalool = await makeProduct("TEST-Linalool", "PUBLISHED", "78-70-6");
    const vanillin = await makeProduct("TEST-Vanillin", "PUBLISHED", "121-33-5");
    const ip = useIp();

    const result = await submitRfq(
      form([
        { productId: linalool.id, name: "typed name is ignored", quantity: "25", unit: "KG" },
        { productId: vanillin.id.toUpperCase(), name: "TEST-Vanillin", quantity: "0.5", unit: "G", notes: "TEST sample" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference).toMatch(new RegExp(`^AQ-${YEAR}-\\d{6}$`));

    const enquiries = await db.enquiry.findMany({ include: { items: { orderBy: { createdAt: "asc" } } } });
    expect(enquiries).toHaveLength(1);
    const [enquiry] = enquiries;
    expect(enquiry.reference).toBe(result.reference);
    // Only catalogue products: an aroma chemicals enquiry.
    expect(enquiry.type).toBe("AROMA_CHEMICALS");
    expect(enquiry.businessSegment).toBe("FRAGRANCES");
    expect(enquiry.status).toBe("NEW");
    expect(enquiry.consentAt).toBeInstanceOf(Date);
    expect(enquiry.ipHash).toBe(hashIp(ip, env.RATE_LIMIT_SALT));
    expect(enquiry.ipHash).not.toContain(ip);
    expect(enquiry.userAgent?.length).toBe(200);

    const items = await db.enquiryItem.findMany({ orderBy: { productNameSnapshot: "asc" } });
    expect(items).toHaveLength(2);
    expect(items.map((i) => [i.productId, i.productNameSnapshot, i.casSnapshot, i.quantity.toString(), i.unit])).toEqual([
      [linalool.id, "TEST-Linalool", "78-70-6", "25", "KG"],
      [vanillin.id, "TEST-Vanillin", "121-33-5", "0.5", "G"],
    ]);

    const created = await db.enquiryActivity.findMany({ where: { action: "enquiry.created" } });
    expect(created).toHaveLength(1);
    expect(created[0].enquiryId).toBe(enquiry.id);
    expect(created[0].actorId).toBeNull();
  });

  it("honeypot filled: reports success with a well-formed reference and stores and sends nothing", async () => {
    useIp();
    const result = await submitRfq(form([freeLine()], { website: "http://spam.example" }, [pdf()]));
    // Same shape as a real success, so a bot cannot tell it was discarded.
    expect(result).toStrictEqual({
      ok: true,
      reference: expect.stringMatching(/^AQ-\d{4}-\d{6}$/),
      droppedProducts: [],
      warnings: {},
    });
    await expectNothingStored();
    expect(state.sent).toEqual([]);
    // Not counted against the rate limit either.
    expect(await db.rateLimitHit.count()).toBe(0);
  });

  it("the 6th submission from one IP within the hour is refused; another IP still works", async () => {
    const ip = useIp();
    for (let i = 0; i < 5; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
    }
    state.headers = new Headers({ "x-forwarded-for": ip });
    const blocked = await submitRfq(form([freeLine()]));
    expect(blocked).toEqual({ ok: false, errors: { form: "Too many requests. Please try again later." } });
    expect(await db.enquiry.count()).toBe(5);

    // The limiter key is the salted hash, never the raw IP.
    const hits = await db.rateLimitHit.findMany();
    expect(hits).toHaveLength(1);
    expect(hits[0].key).not.toContain(ip);
    expect(hits[0].count).toBe(6);
    expect(hits[0].windowStart.getTime() % (60 * 60 * 1000)).toBe(0);

    useIp();
    expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
  });

  it("keeps unpublished and unknown product lines as free text without a product link", async () => {
    const draft = await makeProduct("TEST-Draft secret name", "DRAFT", "64-17-5");
    useIp();
    const result = await submitRfq(
      form([
        { productId: draft.id, name: "TEST typed draft", quantity: "1", unit: "KG" },
        { productId: "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f", name: "TEST typed unknown", quantity: "2", unit: "L" },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.droppedProducts).toEqual(["TEST typed draft", "TEST typed unknown"]);
    const items = await db.enquiryItem.findMany({ orderBy: { productNameSnapshot: "asc" } });
    expect(items.map((i) => [i.productId, i.productNameSnapshot, i.casSnapshot])).toEqual([
      [null, "TEST typed draft", null],
      [null, "TEST typed unknown", null],
    ]);
    // The draft's own name never leaks into the result.
    expect(JSON.stringify(result)).not.toContain("secret");
    // Not every line is a catalogue product: the type follows the segment.
    expect((await db.enquiry.findFirstOrThrow()).type).toBe("FRAGRANCES");
  });

  it("returns field errors keyed by path and stores nothing for invalid input", async () => {
    useIp();
    const result = await submitRfq(
      form([{ name: "TEST x", quantity: "0", unit: "KG" }, { name: "", quantity: "1", unit: "BARREL" }], {
        email: "not-an-email",
        consent: "",
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok || !("email" in result.errors)) throw new Error("expected field errors");
    const errors = result.errors as Record<string, string[]>;
    expect(Object.keys(errors).sort()).toEqual(
      ["consent", "email", "items.0.quantity", "items.1.name", "items.1.unit"].sort(),
    );
    expect(errors.email[0]).toEqual(expect.any(String));
    await expectNothingStored();
  });

  it("returns the free-mail hint as a warning on success", async () => {
    useIp();
    const result = await submitRfq(form([freeLine()], { email: "jane.test@gmail.com" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toHaveProperty("email");
  });

  it("accepts five attachments and rejects a sixth", async () => {
    useIp();
    const five = Array.from({ length: 5 }, (_, i) => pdf(`TEST-${i}.pdf`));
    const ok = await submitRfq(form([freeLine()], {}, five));
    expect(ok.ok).toBe(true);
    expect(await db.enquiryAttachment.count()).toBe(5);
    expect(await storedFiles()).toHaveLength(5);

    await resetDb();
    await rm(state.root, { recursive: true, force: true });
    useIp();
    const six = Array.from({ length: 6 }, (_, i) => pdf(`TEST-${i}.pdf`));
    const refused = await submitRfq(form([freeLine()], {}, six));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors).toHaveProperty("attachments");
    await expectNothingStored();
  });

  it("rejects an attachment whose bytes do not match its extension and stores nothing", async () => {
    useIp();
    const fake = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03])], "TEST-invoice.pdf", {
      type: "application/pdf",
    });
    const result = await submitRfq(form([freeLine()], {}, [pdf("TEST-good.pdf"), fake]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.errors as Record<string, string[]>;
      expect(errors.attachments[0]).toContain("TEST-invoice.pdf");
    }
    await expectNothingStored();
  });

  it("ignores the empty file part a browser sends for an unused file input", async () => {
    useIp();
    const result = await submitRfq(form([freeLine()], {}, [new File([], "", { type: "application/octet-stream" })]));
    expect(result.ok).toBe(true);
    expect(await db.enquiryAttachment.count()).toBe(0);
  });

  it("stores an attachment under a random key with a matching row, readable back", async () => {
    useIp();
    const bytes = new TextEncoder().encode("%PDF-1.4\n% TEST attachment body\n%%EOF\n");
    const file = new File([bytes], "../../TEST Quote request.pdf", { type: "application/pdf" });
    const result = await submitRfq(form([freeLine()], {}, [file]));
    expect(result.ok).toBe(true);

    const [row] = await db.enquiryAttachment.findMany();
    expect(row.filename).toBe("TEST Quote request.pdf");
    expect(row.mimeType).toBe("application/pdf");
    expect(row.sizeBytes).toBe(bytes.length);
    expect(row.storageKey).toMatch(/^rfq-[A-Za-z0-9_-]{43}$/);
    expect(row.storageKey).not.toContain("TEST");
    expect(await storedFiles()).toEqual([row.storageKey]);

    const stream = await getStorage().getStream(row.storageKey);
    expect(stream).not.toBeNull();
    const back = new Uint8Array(await new Response(stream).arrayBuffer());
    expect(back).toEqual(bytes);

    const json = JSON.stringify(result);
    expect(json).not.toContain(row.storageKey);
  });

  it("a failed transaction leaves no enquiry rows and no orphan files", async () => {
    const spies = silence();
    // A real database failure on the second item insert.
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_fail_item() RETURNS trigger AS $$
      BEGIN
        IF NEW."productNameSnapshot" = 'TEST-FAIL-ITEM' THEN
          RAISE EXCEPTION 'TEST forced item failure';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER test_fail_item BEFORE INSERT ON "enquiry_item"
      FOR EACH ROW EXECUTE FUNCTION test_fail_item()`);
    try {
      useIp();
      const result = await submitRfq(
        form([freeLine(), freeLine("TEST-FAIL-ITEM")], {}, [pdf("TEST-a.pdf"), pdf("TEST-b.pdf")]),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toEqual({ form: expect.any(String) });
        expect(JSON.stringify(result)).not.toContain("TEST forced");
      }
      await expectNothingStored();
      expect(state.sent).toEqual([]);
      expect(spies.error).toHaveBeenCalled();
      // Logs carry no PII.
      const logged = JSON.stringify(spies.error.mock.calls);
      expect(logged).not.toContain("jane@testfragrance.example");
      expect(logged).not.toContain("TEST Jane Buyer");
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_item ON "enquiry_item"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_item()`);
    }
  });

  it("concurrent submissions all succeed with distinct, sequential references", async () => {
    const forms = Array.from({ length: 6 }, (_, i) => {
      return { fd: form([freeLine(`TEST concurrent ${i}`)]), ip: `203.0.113.${i + 1}` };
    });
    const results = await Promise.all(
      forms.map(async ({ fd, ip }) => {
        state.headers = new Headers({ "x-forwarded-for": ip });
        return submitRfq(fd);
      }),
    );
    const refs = results.map((r) => (r.ok ? r.reference : `failed`));
    expect(refs).not.toContain("failed");
    expect(new Set(refs).size).toBe(6);
    const seqs = refs.map((r) => Number(r.slice(-6))).sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await db.enquiry.count()).toBe(6);
  });

  it("continues numbering after the highest existing reference for the year", async () => {
    useIp();
    const first = await submitRfq(form([freeLine()]));
    useIp();
    const second = await submitRfq(form([freeLine()]));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.reference).toBe(`AQ-${YEAR}-000001`);
      expect(second.reference).toBe(`AQ-${YEAR}-000002`);
    }
  });

  it("an email provider that throws still succeeds and records email.failed without addresses", async () => {
    const spies = silence();
    state.failEmail = true;
    useIp();
    const result = await submitRfq(form([freeLine()]));
    expect(result.ok).toBe(true);
    const failed = await db.enquiryActivity.findMany({ where: { action: "email.failed" } });
    expect(failed).toHaveLength(2);
    const detail = JSON.stringify(failed.map((a) => a.detail));
    expect(detail).toContain("Error");
    expect(detail).not.toContain("@");
    expect(await db.enquiryActivity.count({ where: { action: "email.sent" } })).toBe(0);
    expect(JSON.stringify(spies.error.mock.calls)).not.toContain("@");
  });

  it("with no recipients configured: skips the internal email, records it, still acknowledges", async () => {
    const spies = silence();
    await db.siteSetting.deleteMany();
    useIp();
    const result = await submitRfq(form([freeLine()]));
    expect(result.ok).toBe(true);
    const skipped = await db.enquiryActivity.findMany({ where: { action: "notification.skipped" } });
    expect(skipped).toHaveLength(1);
    expect(skipped[0].detail).toEqual({ reason: "no recipients configured" });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to).toEqual(["jane@testfragrance.example"]);
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spies.warn.mock.calls)).not.toContain("@");
  });

  it("with a recipient configured: sends both emails and records email.sent; invalid recipients ignored", async () => {
    await db.siteSetting.deleteMany();
    await setRecipients("FRAGRANCES", ["fragrance-team@test.example", "not an email", 42, "fragrance-team@test.example"]);
    useIp();
    const result = await submitRfq(form([freeLine()]));
    expect(result.ok).toBe(true);
    expect(state.sent).toHaveLength(2);
    const internal = state.sent.find((m) => m.to.includes("fragrance-team@test.example"));
    expect(internal?.to).toEqual(["fragrance-team@test.example"]);
    expect(internal?.text).toContain("TEST Fragrance House Ltd");
    const ack = state.sent.find((m) => m.to.includes("jane@testfragrance.example"));
    expect(ack?.subject).toContain(result.ok ? result.reference : "");
    const sent = await db.enquiryActivity.findMany({ where: { action: "email.sent" } });
    expect(sent).toHaveLength(2);
    expect(JSON.stringify(sent.map((a) => a.detail))).not.toContain("@");
  });

  it("never returns internal fields", async () => {
    const product = await makeProduct("TEST-Linalool", "PUBLISHED", "78-70-6");
    const ip = useIp();
    const result = await submitRfq(
      form([{ productId: product.id, name: "TEST-Linalool", quantity: "1", unit: "KG" }], {}, [pdf()]),
    );
    expect(result.ok).toBe(true);
    const enquiry = await db.enquiry.findFirstOrThrow({ include: { attachments: true } });
    const json = JSON.stringify(result);
    for (const secret of [enquiry.ipHash ?? "x", ip, "TEST-Agent", enquiry.attachments[0].storageKey, enquiry.id]) {
      expect(json).not.toContain(secret);
    }
    expect(Object.keys(result).sort()).toEqual(["droppedProducts", "ok", "reference", "warnings"].sort());
  });

  it("without a trustworthy client IP stores no hash and uses one shared bucket", async () => {
    state.headers = new Headers({ "x-forwarded-for": "203.0.113.50, 198.51.100.99" });
    const spies = silence();
    const result = await submitRfq(form([freeLine()]));
    expect(result.ok).toBe(true);
    expect((await db.enquiry.findFirstOrThrow()).ipHash).toBeNull();
    const [hit] = await db.rateLimitHit.findMany();
    expect(hit.key).toBe("rfq:no-trusted-ip");
    expect(spies.warn).toHaveBeenCalled();
  });
});
