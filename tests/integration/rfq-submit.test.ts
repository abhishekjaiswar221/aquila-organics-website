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
  emailMode: "ok" as "ok" | "throw" | "hang",
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
        if (state.emailMode === "hang") return new Promise<void>(() => {});
        if (state.emailMode === "throw") throw new Error("SMTP refused for jane@testfragrance.example");
        state.sent.push(msg);
      },
    }),
  };
});

const { submitRfq } = await import("@/features/enquiries/actions");
const { getStorage } = await import("@/lib/storage");
const { hashIp } = await import("@/lib/client-ip");
const { env } = await import("@/lib/env");
const {
  rfqTesting,
  rfqAckLimitKey,
  RFQ_ACK_LIMIT,
  RFQ_ACK_WINDOW_MS,
  RFQ_RATE_LIMIT,
  RFQ_UNRESOLVED_IP_RATE_LIMIT,
  RFQ_RATE_WINDOW_MS,
} = await import("@/features/enquiries/submit");

/** Per-IP submission limiter rows only (the acknowledgement limiter uses "rfq-ack:"). */
const IP_HITS = { where: { key: { startsWith: "rfq:" } } };

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
  state.emailMode = "ok";
  rfqTesting.reset();
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
    expect(RFQ_RATE_LIMIT).toBe(5);
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
    const hits = await db.rateLimitHit.findMany(IP_HITS);
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
    // Junk that fails field validation never consumes the rate-limit bucket.
    expect(await db.rateLimitHit.count()).toBe(0);
  });

  it("invalid-field submissions do not use up a visitor's limit", async () => {
    const ip = useIp();
    for (let i = 0; i < 8; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitRfq(form([freeLine()], { email: "nope" }))).ok).toBe(false);
    }
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
    expect((await db.rateLimitHit.findFirstOrThrow(IP_HITS)).count).toBe(1);
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
    state.emailMode = "throw";
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
    const [hit] = await db.rateLimitHit.findMany(IP_HITS);
    expect(hit.key).toBe("rfq:no-trusted-ip");
    // Outside production nothing is logged.
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it("the shared unresolved-IP bucket allows 100 an hour, not 5", async () => {
    expect(RFQ_UNRESOLVED_IP_RATE_LIMIT).toBe(100);
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / RFQ_RATE_WINDOW_MS) * RFQ_RATE_WINDOW_MS);
    // Seed the bucket near its cap instead of looping 100 real submissions.
    await db.rateLimitHit.create({
      data: { key: "rfq:no-trusted-ip", windowStart, count: RFQ_UNRESOLVED_IP_RATE_LIMIT - 2 },
    });
    const unresolved = () => {
      state.headers = new Headers({ "x-forwarded-for": "203.0.113.50, 198.51.100.99" });
    };
    unresolved();
    expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
    unresolved();
    expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
    unresolved();
    expect(await submitRfq(form([freeLine()]))).toEqual({
      ok: false,
      errors: { form: "Too many requests. Please try again later." },
    });
    // A visitor with a resolvable IP has their own bucket.
    useIp();
    expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
  });

  it("in production, warns once per process when no IP header config exists and the IP is unresolved", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const spies = silence();
      for (let i = 0; i < 3; i++) {
        state.headers = new Headers({ "x-forwarded-for": "203.0.113.50, 198.51.100.99" });
        expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
      }
      expect(spies.warn).toHaveBeenCalledTimes(1);
      const message = String(spies.warn.mock.calls[0][0]);
      expect(message).toContain("AUTH_IP_HEADER");
      expect(message).toContain("shared");
      expect(message).not.toMatch(/@|203\.0\.113|198\.51\.100/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("submitRfq idempotency (submissionId)", () => {
  const TOKEN = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";

  it("the same submissionId twice creates one enquiry, one set of emails, no second files", async () => {
    useIp();
    const first = await submitRfq(form([freeLine()], { submissionId: TOKEN }, [pdf()]));
    expect(first.ok).toBe(true);
    const filesAfterFirst = await storedFiles();
    const sentAfterFirst = state.sent.length;
    const hitsAfterFirst = (await db.rateLimitHit.findFirstOrThrow(IP_HITS)).count;

    const second = await submitRfq(form([freeLine()], { submissionId: TOKEN }, [pdf()]));
    expect(second).toEqual(first.ok ? { ok: true, reference: first.reference, droppedProducts: [], warnings: {} } : null);
    expect(await db.enquiry.count()).toBe(1);
    expect(await db.enquiryAttachment.count()).toBe(1);
    expect(await storedFiles()).toEqual(filesAfterFirst);
    expect(state.sent.length).toBe(sentAfterFirst);
    // A replay is not counted against the rate limit.
    expect((await db.rateLimitHit.findFirstOrThrow(IP_HITS)).count).toBe(hitsAfterFirst);
    expect((await db.enquiry.findFirstOrThrow()).submissionId).toBe(TOKEN);
  });

  it("three concurrent posts with one submissionId create exactly one enquiry; losers' files removed", async () => {
    const ip = useIp();
    const results = await Promise.all(
      [1, 2, 3].map(async () => {
        state.headers = new Headers({ "x-forwarded-for": ip });
        return submitRfq(form([freeLine()], { submissionId: TOKEN }, [pdf()]));
      }),
    );
    const refs = results.map((r) => (r.ok ? r.reference : "failed"));
    expect(new Set(refs).size).toBe(1);
    expect(refs[0]).toMatch(/^AQ-\d{4}-\d{6}$/);
    expect(await db.enquiry.count()).toBe(1);
    const rows = await db.enquiryAttachment.findMany();
    expect(rows).toHaveLength(1);
    expect(await storedFiles()).toEqual([rows[0].storageKey]);
    // Emails only for the winner.
    expect(state.sent).toHaveLength(2);
  });

  it("different submissionIds create separate enquiries", async () => {
    useIp();
    await submitRfq(form([freeLine()], { submissionId: TOKEN }));
    await submitRfq(form([freeLine()], { submissionId: "6b5c4d3e-2f1a-4b0c-9d8e-7f6a5b4c3d2e" }));
    expect(await db.enquiry.count()).toBe(2);
  });

  it("without a submissionId, posting twice creates two enquiries", async () => {
    useIp();
    await submitRfq(form([freeLine()]));
    await submitRfq(form([freeLine()]));
    expect(await db.enquiry.count()).toBe(2);
    expect((await db.enquiry.findFirstOrThrow()).submissionId).toBeNull();
  });
});

describe("email timeout", () => {
  it("an email provider that never resolves times out, records email.failed, still succeeds", async () => {
    const spies = silence();
    rfqTesting.setEmailTimeoutMs(50);
    state.emailMode = "hang";
    useIp();
    const started = Date.now();
    const result = await submitRfq(form([freeLine()]));
    expect(Date.now() - started).toBeLessThan(3000);
    expect(result.ok).toBe(true);
    const failed = await db.enquiryActivity.findMany({ where: { action: "email.failed" } });
    expect(failed).toHaveLength(2);
    expect(JSON.stringify(failed.map((a) => a.detail))).toContain("timed out");
    expect(spies.error).toHaveBeenCalled();
  });

  it("defaults to an 8 second email timeout", () => {
    expect(rfqTesting.emailTimeoutMs()).toBe(8000);
  });
});

describe("acknowledgement limit per recipient", () => {
  const JANE = "jane@testfragrance.example";
  const acksTo = (address: string) => state.sent.filter((m) => m.to.includes(address));
  const internals = () => state.sent.filter((m) => m.to.some((t) => t.endsWith("@test.example")));
  const ackRows = () => db.rateLimitHit.findMany({ where: { key: { startsWith: "rfq-ack:" } } });
  /** A distinct client IP per loop iteration (the database is reset per test). */
  const loopIp = (i: number) => {
    state.headers = new Headers({ "x-forwarded-for": `192.0.2.${i + 1}`, "user-agent": UA });
  };

  it("allows 3 acknowledgements per address per 24 hours", () => {
    expect(RFQ_ACK_LIMIT).toBe(3);
    expect(RFQ_ACK_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("the 4th submission is stored and notified internally, but gets no acknowledgement", async () => {
    const spies = silence();
    const refs: string[] = [];
    for (let i = 0; i < 4; i++) {
      // A new IP each time: the per-IP submission limit is not what stops it.
      loopIp(i);
      const result = await submitRfq(form([freeLine(), freeLine("TEST second line")]));
      expect(result.ok).toBe(true);
      if (result.ok) refs.push(result.reference);
      expect(acksTo(JANE)).toHaveLength(Math.min(i + 1, 3));
      expect(internals()).toHaveLength(i + 1);
    }
    expect(await db.enquiry.count()).toBe(4);

    const fourth = await db.enquiry.findUniqueOrThrow({ where: { reference: refs[3] }, include: { activities: true } });
    const actions = fourth.activities.map((a) => a.action).sort();
    expect(actions).toEqual(["email.sent", "email.skipped", "enquiry.created"].sort());
    const skipped = fourth.activities.find((a) => a.action === "email.skipped");
    expect(skipped?.detail).toEqual({ reason: "recipient limit" });
    const sent = fourth.activities.find((a) => a.action === "email.sent");
    expect(sent?.detail).toMatchObject({ kind: "internal" });
    // Nothing logged carries the address.
    expect(JSON.stringify([spies.warn.mock.calls, spies.error.mock.calls])).not.toContain("@");
  });

  it("a different address is unaffected", async () => {
    silence();
    for (let i = 0; i < 4; i++) {
      loopIp(i);
      await submitRfq(form([freeLine()]));
    }
    useIp();
    expect((await submitRfq(form([freeLine()], { email: "other.buyer@testfragrance.example" }))).ok).toBe(true);
    expect(acksTo("other.buyer@testfragrance.example")).toHaveLength(1);
  });

  it("case and whitespace variants of one address count as one recipient", async () => {
    silence();
    for (const [i, email] of [JANE, "JANE@TestFragrance.Example", `  ${JANE}  `, "Jane@testfragrance.example"].entries()) {
      loopIp(i);
      expect((await submitRfq(form([freeLine()], { email }))).ok).toBe(true);
    }
    expect(state.sent.filter((m) => m.subject.startsWith("We received"))).toHaveLength(3);
    const rows = await ackRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(4);
    expect(rfqAckLimitKey("JANE@TestFragrance.Example ")).toBe(rfqAckLimitKey(JANE));
  });

  it("plus tags, Gmail dots and googlemail.com share one quota; mail still goes to the typed address", async () => {
    const spies = silence();
    const variants = ["victim+1@gmail.com", "v.ictim+2@googlemail.com", "VICTIM@gmail.com", "vic.tim+4@gmail.com"];
    const refs: string[] = [];
    for (const [i, email] of variants.entries()) {
      loopIp(i);
      const result = await submitRfq(form([freeLine()], { email }));
      expect(result.ok).toBe(true);
      if (result.ok) refs.push(result.reference);
    }
    const acks = state.sent.filter((m) => m.subject.startsWith("We received"));
    expect(acks.map((m) => m.to)).toEqual([["victim+1@gmail.com"], ["v.ictim+2@googlemail.com"], ["VICTIM@gmail.com"]]);
    const fourth = await db.enquiry.findUniqueOrThrow({ where: { reference: refs[3] }, include: { activities: true } });
    expect(fourth.activities.find((a) => a.action === "email.skipped")?.detail).toEqual({ reason: "recipient limit" });
    expect(fourth.email).toBe("vic.tim+4@gmail.com");

    loopIp(9);
    expect((await submitRfq(form([freeLine()], { email: "someone.else@gmail.com" }))).ok).toBe(true);
    expect(acksTo("someone.else@gmail.com")).toHaveLength(1);

    const rows = await ackRows();
    expect(rows.map((r) => r.count).sort()).toEqual([1, 4]);
    for (const row of rows) {
      for (const part of ["victim", "gmail", "googlemail", "someone"]) expect(row.key).not.toContain(part);
    }
    expect(JSON.stringify([spies.warn.mock.calls, spies.error.mock.calls])).not.toContain("@");
  });

  it("the limiter key is a salted hash: no raw address in RateLimitHit", async () => {
    useIp();
    await submitRfq(form([freeLine()]));
    const rows = await db.rateLimitHit.findMany();
    expect(rows.length).toBeGreaterThan(0);
    const [ack] = await ackRows();
    expect(ack.key).toMatch(/^rfq-ack:[0-9a-f]{64}$/);
    expect(ack.key).toBe(rfqAckLimitKey(JANE));
    expect(ack.windowStart.getTime() % RFQ_ACK_WINDOW_MS).toBe(0);
    for (const row of rows) {
      for (const part of [JANE, "jane", "testfragrance"]) expect(row.key.toLowerCase()).not.toContain(part);
    }
    // Salted: not the plain SHA-256 of the address.
    const { createHash } = await import("node:crypto");
    expect(ack.key).not.toContain(createHash("sha256").update(JANE).digest("hex"));
  });

  it("applies independently of the per-IP limit: one IP, two addresses", async () => {
    silence();
    const ip = useIp();
    for (let i = 0; i < 4; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
    }
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect((await submitRfq(form([freeLine()], { email: "second@testfragrance.example" }))).ok).toBe(true);
    // The IP used 5 of its 5; the first address hit its ack cap, the second did not.
    expect(acksTo(JANE)).toHaveLength(3);
    expect(acksTo("second@testfragrance.example")).toHaveLength(1);
    expect((await db.rateLimitHit.findFirstOrThrow(IP_HITS)).count).toBe(5);
  });

  it("a replayed submission sends nothing and uses no acknowledgement quota", async () => {
    const TOKEN = "7c6b5a4d-3e2f-4a1b-9c0d-8e7f6a5b4c3d";
    useIp();
    await submitRfq(form([freeLine()], { submissionId: TOKEN }));
    await submitRfq(form([freeLine()], { submissionId: TOKEN }));
    await submitRfq(form([freeLine()], { submissionId: TOKEN }));
    expect(acksTo(JANE)).toHaveLength(1);
    expect((await ackRows())[0].count).toBe(1);
  });

  it("the honeypot path sends nothing and uses no quota", async () => {
    useIp();
    await submitRfq(form([freeLine()], { website: "http://spam.example" }));
    expect(state.sent).toEqual([]);
    expect(await ackRows()).toEqual([]);
  });

  it("a failed acknowledgement send uses one unit of quota and does not fail the submission", async () => {
    silence();
    state.emailMode = "throw";
    useIp();
    expect((await submitRfq(form([freeLine()]))).ok).toBe(true);
    expect((await ackRows())[0].count).toBe(1);
    expect(await db.enquiryActivity.count({ where: { action: "email.failed" } })).toBe(2);
    expect(await db.enquiryActivity.count({ where: { action: "email.skipped" } })).toBe(0);
  });

  it("the acknowledgement repeats no free text: only the reference and the line count", async () => {
    const product = await makeProduct("TEST-Linalool", "PUBLISHED", "78-70-6");
    useIp();
    const result = await submitRfq(
      form(
        [
          { productId: product.id, name: "TEST-Linalool", quantity: "25", unit: "KG", notes: "TEST-line-note visit evil.example" },
          { name: "TEST-Free item click here", quantity: "1", unit: "L" },
        ],
        { additionalRequirements: "TEST-requirements text", companyName: "TEST-Company spam" },
      ),
    );
    expect(result.ok).toBe(true);
    const [ack] = acksTo(JANE);
    const internal = state.sent.find((m) => m.to.includes("sales@test.example") || m.to.includes("sales-fragrance@test.example"));
    for (const secret of ["TEST-line-note", "evil.example", "TEST-Free item", "TEST-requirements", "TEST-Company", "TEST-Linalool"]) {
      expect(`${ack.subject}${ack.html}${ack.text}`).not.toContain(secret);
      expect(internal?.text).toContain(secret);
    }
    expect(ack.text).toContain("2 product lines");
    expect(ack.text).toContain(result.ok ? result.reference : "-");
    expect(ack.text).toContain("Dear TEST Jane Buyer,");
  });
});
