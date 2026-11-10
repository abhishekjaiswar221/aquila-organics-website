import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";
import { db, resetDb } from "./setup";

// Same fakes as rfq-submit.test.ts: email provider, storage root, request headers.
const state = vi.hoisted(() => ({
  root: "",
  headers: new Headers(),
  sent: [] as EmailMessage[],
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
        state.sent.push(msg);
      },
    }),
  };
});

const { submitContact } = await import("@/features/contact/actions");
const { submitRfq } = await import("@/features/enquiries/actions");
const { rfqTesting } = await import("@/features/enquiries/submit");
const { getEnquiry, listEnquiries } = await import("@/features/enquiries/queries");
const { describeActivity } = await import("@/features/enquiries/activity-text");

const IP_HITS = { where: { key: { startsWith: "rfq:" } } };
const ACK_HITS = { where: { key: { startsWith: "rfq-ack:" } } };
const JANE = "jane@testfragrance.example";
const MESSAGE = "TEST Please call me about a new brief.\nSecond line: visit evil.example now";
const TOKEN = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const UA = "TEST-Agent/1.0";

const RECIPIENTS: Record<string, string> = {
  FRAGRANCES: "sales-fragrance@test.example",
  FLAVOURS: "sales-flavour@test.example",
  AROMA_CHEMICALS: "sales-aroma@test.example",
  GENERAL: "sales@test.example",
};

let ipCounter = 0;
function setIp(ip?: string) {
  ipCounter += 1;
  const address = ip ?? `198.51.100.${ipCounter % 250}`;
  state.headers = new Headers({ "x-forwarded-for": address, "user-agent": UA });
  return address;
}

function form(extra: Record<string, string | undefined> = {}, files: File[] = []): FormData {
  const fd = new FormData();
  const fields: Record<string, string | undefined> = {
    type: "FRAGRANCES",
    fullName: "TEST Jane Buyer",
    companyName: "TEST Fragrance House Ltd",
    email: JANE,
    phone: "+44 20 7946 0000",
    country: "United Kingdom",
    application: "fine-fragrance",
    message: MESSAGE,
    consent: "on",
    website: "",
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v);
  for (const f of files) fd.append("attachments", f);
  return fd;
}

function rfqForm(extra: Record<string, string> = {}): FormData {
  const fd = form({ type: undefined, application: undefined, message: undefined, businessSegment: "FRAGRANCES", ...extra });
  fd.set("items.0.name", "TEST Custom blend");
  fd.set("items.0.quantity", "5");
  fd.set("items.0.unit", "KG");
  return fd;
}

const pdf = (name = "TEST-brief.pdf") =>
  new File([new TextEncoder().encode("%PDF-1.4\n% TEST fixture\n%%EOF\n")], name, { type: "application/pdf" });

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

const acksTo = (address: string) =>
  state.sent.filter((m) => m.to.includes(address) && m.subject.startsWith("We received"));

beforeAll(async () => {
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-contact-"));
});

afterAll(async () => {
  await rm(state.root, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDb();
  await rm(state.root, { recursive: true, force: true });
  state.sent = [];
  rfqTesting.reset();
  for (const [type, address] of Object.entries(RECIPIENTS)) {
    await db.siteSetting.create({ data: { key: `notification.recipients.${type}`, value: [address] } });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitContact: one message enquiry per type", () => {
  const cases = [
    { type: "FRAGRANCES", application: "fine-fragrance", name: "Fine Fragrance", segment: "FRAGRANCES" },
    { type: "FLAVOURS", application: "bakery", name: "Bakery", segment: "FLAVOURS" },
    { type: "AROMA_CHEMICALS", application: undefined, name: null, segment: "AROMA_CHEMICALS" },
    { type: "GENERAL", application: undefined, name: null, segment: "OTHER" },
  ] as const;

  for (const c of cases) {
    it(`${c.type}: stores the enquiry with zero items, the message and the application, and sends both emails`, async () => {
      setIp();
      const result = await submitContact(form({ type: c.type, application: c.application }));
      expect(result).toStrictEqual({
        ok: true,
        reference: expect.stringMatching(/^AQ-\d{4}-\d{6}$/),
        droppedProducts: [],
        warnings: {},
      });
      if (!result.ok) return;

      const enquiry = await db.enquiry.findUniqueOrThrow({
        where: { reference: result.reference },
        include: { items: true, activities: true },
      });
      expect(await db.enquiry.count()).toBe(1);
      expect(enquiry.type).toBe(c.type);
      expect(enquiry.businessSegment).toBe(c.segment);
      expect(enquiry.intendedApplication).toBe(c.name);
      expect(enquiry.additionalRequirements).toBe(MESSAGE);
      expect(enquiry.items).toEqual([]);
      expect(enquiry.fullName).toBe("TEST Jane Buyer");
      expect(enquiry.consentAt).toBeInstanceOf(Date);
      expect(enquiry.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(enquiry.userAgent).toBe(UA);

      const created = enquiry.activities.filter((a) => a.action === "enquiry.created");
      expect(created).toHaveLength(1);
      expect(created[0].detail).toEqual({ source: "contact-form", items: 0, catalogueItems: 0, attachments: 0 });
      expect(enquiry.activities.map((a) => a.action).sort()).toEqual(["email.sent", "email.sent", "enquiry.created"]);

      expect(state.sent).toHaveLength(2);
      const [ack] = acksTo(JANE);
      expect(ack.subject).toBe(`We received your message ${result.reference}`);
      expect(ack.text).toContain("We have received your message");
      const internal = state.sent.find((m) => m.to.includes(RECIPIENTS[c.type]));
      expect(internal?.to).toEqual([RECIPIENTS[c.type]]);
      expect(internal?.subject).toBe(`New contact message ${result.reference}`);
      expect(internal?.text).toContain(MESSAGE);
      if (c.name) expect(internal?.text).toContain(c.name);
    });
  }

  it("the acknowledgement repeats no visitor text; the internal notification carries it all", async () => {
    setIp();
    const result = await submitContact(
      form({
        fullName: "Claim your refund at evil-name.example/r now",
        companyName: "TEST-Company spam",
        country: "TEST-Country text",
        message: "TEST-Message <b>click</b> evil.example",
      }),
    );
    expect(result.ok).toBe(true);
    const [ack] = acksTo(JANE);
    const internal = state.sent.find((m) => m.to.includes(RECIPIENTS.FRAGRANCES));
    for (const secret of [
      "Claim your refund",
      "evil-name.example",
      "TEST-Company",
      "TEST-Country",
      "TEST-Message",
      "evil.example",
      "Fine Fragrance",
    ]) {
      expect(`${ack.subject}${ack.html}${ack.text}`).not.toContain(secret);
      expect(internal?.text).toContain(secret);
    }
    expect(internal?.html).toContain("TEST-Message &lt;b&gt;click&lt;/b&gt;");
    expect(ack.text.startsWith("Dear customer,")).toBe(true);
  });

  it("returns the free-mail hint as a warning on success", async () => {
    setIp();
    const result = await submitContact(form({ email: "jane.test@gmail.com" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toHaveProperty("email");
  });
});

describe("submitContact: the enquiry type comes from the server-side enum only", () => {
  it("a hostile or invalid type is a field error on type and stores nothing", async () => {
    for (const type of ["CAREERS", "ADMIN", "", "fragrances", "GENERAL ", undefined]) {
      setIp();
      const result = await submitContact(form({ type, application: undefined }));
      expect(result.ok, String(type)).toBe(false);
      if (result.ok) continue;
      expect(Object.keys(result.errors), String(type)).toEqual(["type"]);
    }
    await expectNothingStored();
    expect(state.sent).toEqual([]);
    // Junk never consumes the limiter.
    expect(await db.rateLimitHit.count()).toBe(0);
  });

  it("an application that does not belong to the type is a field error and stores nothing", async () => {
    for (const [type, application] of [
      ["FLAVOURS", "fine-fragrance"],
      ["FRAGRANCES", "FINE-FRAGRANCE"],
      ["AROMA_CHEMICALS", "fine-fragrance"],
      ["GENERAL", "bakery"],
    ]) {
      setIp();
      const result = await submitContact(form({ type, application }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors)).toEqual(["application"]);
    }
    await expectNothingStored();
  });

  it("ignores RFQ-only fields: posted product lines and a business segment are not stored", async () => {
    setIp();
    const fd = form({ type: "GENERAL", application: undefined, businessSegment: "FRAGRANCES" });
    fd.set("items.0.name", "TEST smuggled line");
    fd.set("items.0.quantity", "5");
    fd.set("items.0.unit", "KG");
    const result = await submitContact(fd);
    expect(result.ok).toBe(true);
    const enquiry = await db.enquiry.findFirstOrThrow({ include: { items: true } });
    expect(enquiry.items).toEqual([]);
    expect(enquiry.type).toBe("GENERAL");
    expect(enquiry.businessSegment).toBe("OTHER");
  });

  it("missing consent, short message and bad email are field errors", async () => {
    setIp();
    const result = await submitContact(form({ consent: "", message: "short", email: "nope" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["consent", "email", "message"]);
    await expectNothingStored();
  });
});

describe("submitContact: shared guards", () => {
  it("honeypot filled: looks like success, stores, sends and counts nothing", async () => {
    setIp();
    const result = await submitContact(form({ website: "http://spam.example" }, [pdf()]));
    expect(result).toStrictEqual({
      ok: true,
      reference: expect.stringMatching(/^AQ-\d{4}-\d{6}$/),
      droppedProducts: [],
      warnings: {},
    });
    await expectNothingStored();
    expect(state.sent).toEqual([]);
    expect(await db.rateLimitHit.count()).toBe(0);
  });

  it("the 6th submission from one IP within the hour is refused", async () => {
    const ip = setIp();
    for (let i = 0; i < 5; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitContact(form({ email: `buyer${i}@testfragrance.example` }))).ok).toBe(true);
    }
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect(await submitContact(form())).toEqual({
      ok: false,
      errors: { form: "Too many requests. Please try again later." },
    });
    expect(await db.enquiry.count()).toBe(5);
    const hits = await db.rateLimitHit.findMany(IP_HITS);
    expect(hits).toHaveLength(1);
    expect(hits[0].key).not.toContain(ip);
  });

  it("shares the per-IP bucket with the RFQ form", async () => {
    const ip = setIp();
    for (let i = 0; i < 3; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitRfq(rfqForm({ email: `rfq${i}@testfragrance.example` }))).ok).toBe(true);
    }
    for (let i = 0; i < 2; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitContact(form({ email: `msg${i}@testfragrance.example` }))).ok).toBe(true);
    }
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect((await submitContact(form())).ok).toBe(false);
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect((await submitRfq(rfqForm())).ok).toBe(false);
  });

  it("a repeated submissionId returns the existing reference with no second row, file or email", async () => {
    setIp();
    const first = await submitContact(form({ submissionId: TOKEN }, [pdf()]));
    expect(first.ok).toBe(true);
    const files = await storedFiles();
    const sent = state.sent.length;
    const hits = (await db.rateLimitHit.findFirstOrThrow(IP_HITS)).count;

    const second = await submitContact(form({ submissionId: TOKEN, message: "TEST a different message body" }, [pdf()]));
    expect(second).toEqual(first.ok ? { ok: true, reference: first.reference, droppedProducts: [], warnings: {} } : null);
    expect(await db.enquiry.count()).toBe(1);
    expect(await db.enquiryAttachment.count()).toBe(1);
    expect(await storedFiles()).toEqual(files);
    expect(state.sent.length).toBe(sent);
    expect((await db.rateLimitHit.findFirstOrThrow(IP_HITS)).count).toBe(hits);
    expect((await db.enquiry.findFirstOrThrow()).additionalRequirements).toBe(MESSAGE);
  });

  it("three concurrent posts with one submissionId create one enquiry; losers' files removed", async () => {
    const ip = setIp();
    const results = await Promise.all(
      [1, 2, 3].map(async () => {
        state.headers = new Headers({ "x-forwarded-for": ip });
        return submitContact(form({ submissionId: TOKEN }, [pdf()]));
      }),
    );
    const refs = results.map((r) => (r.ok ? r.reference : "failed"));
    expect(new Set(refs).size).toBe(1);
    expect(refs[0]).toMatch(/^AQ-\d{4}-\d{6}$/);
    expect(await db.enquiry.count()).toBe(1);
    const rows = await db.enquiryAttachment.findMany();
    expect(rows).toHaveLength(1);
    expect(await storedFiles()).toEqual([rows[0].storageKey]);
    expect(state.sent).toHaveLength(2);
  });

  it("caps acknowledgements per normalised recipient, shared with the RFQ form", async () => {
    const spies = silence();
    const refs: string[] = [];
    const variants = [JANE, "JANE@TestFragrance.Example", ` ${JANE} `];
    for (const [i, email] of variants.entries()) {
      setIp(`192.0.2.${i + 1}`);
      const result = await submitContact(form({ email }));
      expect(result.ok).toBe(true);
      if (result.ok) refs.push(result.reference);
    }
    // The 4th acknowledgement to the same inbox, from the RFQ form, is skipped...
    setIp("192.0.2.10");
    expect((await submitRfq(rfqForm({ email: "Jane@testfragrance.example" }))).ok).toBe(true);
    // ...and so is a 5th from the contact form.
    setIp("192.0.2.11");
    const fifth = await submitContact(form());
    expect(fifth.ok).toBe(true);
    if (fifth.ok) refs.push(fifth.reference);

    const acks = state.sent.filter((m) => m.subject.startsWith("We received"));
    expect(acks).toHaveLength(3);
    const last = await db.enquiry.findUniqueOrThrow({ where: { reference: refs[3] }, include: { activities: true } });
    expect(last.activities.find((a) => a.action === "email.skipped")?.detail).toEqual({ reason: "recipient limit" });
    expect(last.activities.find((a) => a.action === "email.sent")?.detail).toMatchObject({ kind: "internal" });
    const rows = await db.rateLimitHit.findMany(ACK_HITS);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(5);
    expect(rows[0].key).not.toMatch(/jane|testfragrance/i);
    expect(JSON.stringify([spies.warn.mock.calls, spies.error.mock.calls])).not.toContain("@");
  });

  it("with no recipients configured: skips the internal email, records it, still acknowledges", async () => {
    const spies = silence();
    await db.siteSetting.deleteMany();
    setIp();
    const result = await submitContact(form({ type: "GENERAL", application: undefined }));
    expect(result.ok).toBe(true);
    const skipped = await db.enquiryActivity.findMany({ where: { action: "notification.skipped" } });
    expect(skipped).toHaveLength(1);
    expect(skipped[0].detail).toEqual({ reason: "no recipients configured" });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to).toEqual([JANE]);
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(String(spies.warn.mock.calls[0][0])).toContain("[contact]");
    expect(JSON.stringify(spies.warn.mock.calls)).not.toContain("@");
  });
});

describe("submitContact: attachments", () => {
  it("stores a valid attachment with a matching row", async () => {
    setIp();
    const result = await submitContact(form({}, [pdf()]));
    expect(result.ok).toBe(true);
    const [row] = await db.enquiryAttachment.findMany();
    expect(row.filename).toBe("TEST-brief.pdf");
    expect(row.storageKey).toMatch(/^rfq-[A-Za-z0-9_-]{43}$/);
    expect(await storedFiles()).toEqual([row.storageKey]);
    expect(JSON.stringify(result)).not.toContain(row.storageKey);
    const created = await db.enquiryActivity.findFirstOrThrow({ where: { action: "enquiry.created" } });
    expect(created.detail).toMatchObject({ source: "contact-form", items: 0, attachments: 1 });
  });

  it("rejects an .exe renamed .pdf and stores nothing", async () => {
    setIp();
    const fake = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03])], "TEST-invoice.pdf", {
      type: "application/pdf",
    });
    const result = await submitContact(form({}, [pdf("TEST-good.pdf"), fake]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.errors as Record<string, string[]>).attachments[0]).toContain("TEST-invoice.pdf");
    await expectNothingStored();
  });

  it("rejects a sixth attachment", async () => {
    setIp();
    const six = Array.from({ length: 6 }, (_, i) => pdf(`TEST-${i}.pdf`));
    const result = await submitContact(form({}, six));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveProperty("attachments");
    await expectNothingStored();
  });

  it("a failed transaction leaves no enquiry rows and no orphan files", async () => {
    const spies = silence();
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_fail_attachment() RETURNS trigger AS $$
      BEGIN
        IF NEW."filename" = 'TEST-FAIL.pdf' THEN
          RAISE EXCEPTION 'TEST forced attachment failure';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER test_fail_attachment BEFORE INSERT ON "enquiry_attachment"
      FOR EACH ROW EXECUTE FUNCTION test_fail_attachment()`);
    try {
      setIp();
      const result = await submitContact(form({}, [pdf("TEST-a.pdf"), pdf("TEST-FAIL.pdf")]));
      expect(result).toEqual({
        ok: false,
        errors: { form: "We could not submit your enquiry. Please try again in a few minutes." },
      });
      await expectNothingStored();
      expect(state.sent).toEqual([]);
      expect(spies.error).toHaveBeenCalled();
      const logged = JSON.stringify(spies.error.mock.calls);
      expect(logged).toContain("[contact]");
      expect(logged).not.toContain(JANE);
      expect(logged).not.toContain("TEST Jane Buyer");
      expect(logged).not.toContain("TEST Please call");
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_attachment ON "enquiry_attachment"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_attachment()`);
    }
  });
});

describe("admin views of a zero-item enquiry", () => {
  it("listEnquiries and getEnquiry work, and the activity text describes the message", async () => {
    setIp();
    const result = await submitContact(form({ type: "FLAVOURS", application: "dairy" }, [pdf()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const list = await listEnquiries({});
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      reference: result.reference,
      type: "FLAVOURS",
      status: "NEW",
      itemCount: 0,
      attachmentCount: 1,
    });
    expect((await listEnquiries({ q: result.reference })).items).toHaveLength(1);

    const detail = await getEnquiry(list.items[0].id);
    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail.items).toEqual([]);
    expect(detail.type).toBe("FLAVOURS");
    expect(detail.intendedApplication).toBe("Dairy");
    expect(detail.additionalRequirements).toBe(MESSAGE);
    expect(detail.attachments).toHaveLength(1);
    const texts = detail.activities.map((a) => describeActivity(a.action, a.detail));
    expect(texts).toContain("Message received through the contact form, 1 attachment.");
    expect(texts.join(" ")).not.toContain("product line");
  });
});
