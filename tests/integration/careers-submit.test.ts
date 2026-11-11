import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";
import { db, resetDb } from "./setup";

// Same fakes as contact-submit.test.ts: email provider, storage root, request headers.
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

const { submitApplication } = await import("@/features/careers/actions");
const { submitContact } = await import("@/features/contact/actions");
const { rfqTesting } = await import("@/features/enquiries/submit");

const CAREERS_HITS = { where: { key: { startsWith: "careers:" } } };
const RFQ_HITS = { where: { key: { startsWith: "rfq:" } } };
const CANDIDATE = "candidate@testmail.example";
const NAME = "TEST Casey Candidate";
const PHONE = "+44 20 7946 0123";
const MESSAGE = "TEST I would love to join.\nSecond line: visit evil.example now";
const TOKEN = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const UA = "TEST-Agent/1.0";
const HR = "hr@test.example";

let ipCounter = 0;
function setIp(ip?: string) {
  ipCounter += 1;
  const address = ip ?? `198.51.100.${ipCounter % 250}`;
  state.headers = new Headers({ "x-forwarded-for": address, "user-agent": UA });
  return address;
}

function form(extra: Record<string, string | undefined> = {}, cv: File | null | undefined = pdf()): FormData {
  const fd = new FormData();
  const fields: Record<string, string | undefined> = {
    fullName: NAME,
    email: CANDIDATE,
    phone: PHONE,
    country: "United Kingdom",
    message: MESSAGE,
    consent: "on",
    website: "",
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v);
  if (cv) fd.append("cv", cv);
  return fd;
}

const pdf = (name = "TEST-cv.pdf") =>
  new File([new TextEncoder().encode("%PDF-1.4\n% TEST fixture\n%%EOF\n")], name, { type: "application/pdf" });
const docx = (name = "TEST-cv.docx") =>
  new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, ...new TextEncoder().encode("word/document.xml")])],
    name,
  );

async function storedFiles(): Promise<string[]> {
  try {
    return await readdir(state.root);
  } catch {
    return [];
  }
}

async function expectNothingStored() {
  expect(await db.jobApplication.count()).toBe(0);
  expect(await db.applicationFile.count()).toBe(0);
  expect(await storedFiles()).toEqual([]);
}

const silence = () => ({
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
});

const makeJob = (slug: string, data: Record<string, unknown> = {}) =>
  db.jobOpening.create({
    data: {
      slug,
      title: `TEST Title ${slug}`,
      location: "Mumbai",
      employmentType: "FULL_TIME",
      summary: "s",
      description: "d",
      status: "PUBLISHED",
      publishedAt: new Date(),
      ...data,
    },
  });

beforeAll(async () => {
  state.root = await mkdtemp(path.join(os.tmpdir(), "aquila-careers-"));
});

afterAll(async () => {
  await rm(state.root, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDb();
  await rm(state.root, { recursive: true, force: true });
  state.sent = [];
  rfqTesting.reset();
  await db.siteSetting.create({ data: { key: "notification.recipients.CAREERS", value: [HR] } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitApplication: a valid application", () => {
  it("stores one application with one CV object, status NEW, and the job title snapshot", async () => {
    const job = await makeJob("chemist");
    setIp();
    const result = await submitApplication(form({ job: "chemist" }));
    expect(result).toStrictEqual({
      ok: true,
      reference: expect.stringMatching(/^CA-\d{4}-\d{6}$/),
      droppedProducts: [],
      warnings: {},
    });
    if (!result.ok) return;

    expect(await db.jobApplication.count()).toBe(1);
    const app = await db.jobApplication.findUniqueOrThrow({
      where: { reference: result.reference },
      include: { files: true },
    });
    expect(app.status).toBe("NEW");
    expect(app.jobId).toBe(job.id);
    expect(app.jobTitleSnapshot).toBe("TEST Title chemist");
    expect(app.fullName).toBe(NAME);
    expect(app.email).toBe(CANDIDATE);
    expect(app.phone).toBe(PHONE);
    expect(app.message).toBe(MESSAGE);
    expect(app.consentAt).toBeInstanceOf(Date);
    expect(app.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(app.userAgent).toBe(UA);
    expect(app.files).toHaveLength(1);
    expect(app.files[0]).toMatchObject({ filename: "TEST-cv.pdf", mimeType: "application/pdf" });
    expect(app.files[0].storageKey).toMatch(/^cv-[A-Za-z0-9_-]{43}$/);
    expect(await storedFiles()).toEqual([app.files[0].storageKey]);
    expect(JSON.stringify(result)).not.toContain(app.files[0].storageKey);
  });

  it("accepts a DOCX", async () => {
    setIp();
    const result = await submitApplication(form({}, docx()));
    expect(result.ok).toBe(true);
    const file = await db.applicationFile.findFirstOrThrow();
    expect(file.filename).toBe("TEST-cv.docx");
    expect(file.mimeType).toContain("wordprocessingml");
    expect(await storedFiles()).toEqual([file.storageKey]);
  });

  it("a general application (no job) stores jobId null and 'General application'", async () => {
    setIp();
    const result = await submitApplication(form());
    expect(result.ok).toBe(true);
    const app = await db.jobApplication.findFirstOrThrow();
    expect(app.jobId).toBeNull();
    expect(app.jobTitleSnapshot).toBe("General application");
  });

  it("numbers references in sequence under the CA- prefix", async () => {
    setIp();
    const a = await submitApplication(form({ email: "a@testmail.example" }));
    const b = await submitApplication(form({ email: "b@testmail.example" }));
    const year = new Date().getUTCFullYear();
    expect(a.ok && a.reference).toBe(`CA-${year}-000001`);
    expect(b.ok && b.reference).toBe(`CA-${year}-000002`);
  });
});

describe("submitApplication: only public openings are ever stored", () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cases: [string, () => Promise<unknown>, string][] = [
    ["DRAFT", () => makeJob("draft-job", { status: "DRAFT", publishedAt: null }), "draft-job"],
    ["CLOSED", () => makeJob("closed-job", { status: "CLOSED" }), "closed-job"],
    ["expired", () => makeJob("expired-job", { closesOn: yesterday }), "expired-job"],
    ["unknown", async () => undefined, "no-such-job"],
  ];
  for (const [label, setup, slug] of cases) {
    it(`a ${label} slug becomes a general application`, async () => {
      await setup();
      setIp();
      const result = await submitApplication(form({ job: slug }));
      expect(result.ok).toBe(true);
      const app = await db.jobApplication.findFirstOrThrow();
      expect(app.jobId).toBeNull();
      expect(app.jobTitleSnapshot).toBe("General application");
      const jobs = await db.jobOpening.findMany();
      for (const j of jobs) expect(await db.jobApplication.count({ where: { jobId: j.id } })).toBe(0);
    });
  }
});

describe("submitApplication: shared guards", () => {
  it("honeypot filled: looks like success, stores, sends and counts nothing", async () => {
    setIp();
    const result = await submitApplication(form({ website: "http://spam.example" }));
    expect(result).toStrictEqual({
      ok: true,
      reference: expect.stringMatching(/^CA-\d{4}-\d{6}$/),
      droppedProducts: [],
      warnings: {},
    });
    await expectNothingStored();
    expect(state.sent).toEqual([]);
    expect(await db.rateLimitHit.count()).toBe(0);
  });

  it("a replayed submissionId returns the same reference and creates nothing more", async () => {
    setIp();
    const first = await submitApplication(form({ submissionId: TOKEN }));
    expect(first.ok).toBe(true);
    const files = await storedFiles();
    const sent = state.sent.length;
    const hits = (await db.rateLimitHit.findFirstOrThrow(CAREERS_HITS)).count;

    const second = await submitApplication(form({ submissionId: TOKEN, message: "TEST different body" }));
    expect(second).toEqual(first);
    expect(await db.jobApplication.count()).toBe(1);
    expect(await db.applicationFile.count()).toBe(1);
    expect(await storedFiles()).toEqual(files);
    expect(state.sent.length).toBe(sent);
    expect((await db.rateLimitHit.findFirstOrThrow(CAREERS_HITS)).count).toBe(hits);
    expect((await db.jobApplication.findFirstOrThrow()).message).toBe(MESSAGE);
  });

  it("concurrent posts with one submissionId create one application; losers' CVs are removed", async () => {
    const ip = setIp();
    const results = await Promise.all(
      [1, 2, 3].map(async () => {
        state.headers = new Headers({ "x-forwarded-for": ip });
        return submitApplication(form({ submissionId: TOKEN }));
      }),
    );
    const refs = results.map((r) => (r.ok ? r.reference : "failed"));
    expect(new Set(refs).size).toBe(1);
    expect(refs[0]).toMatch(/^CA-\d{4}-\d{6}$/);
    expect(await db.jobApplication.count()).toBe(1);
    const rows = await db.applicationFile.findMany();
    expect(rows).toHaveLength(1);
    expect(await storedFiles()).toEqual([rows[0].storageKey]);
  });

  it("the 6th submission from one IP within the hour is refused and stores nothing", async () => {
    const ip = setIp();
    for (let i = 0; i < 5; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect((await submitApplication(form({ email: `c${i}@testmail.example` }))).ok).toBe(true);
    }
    const files = await storedFiles();
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect(await submitApplication(form())).toEqual({
      ok: false,
      errors: { form: "Too many requests. Please try again later." },
    });
    expect(await db.jobApplication.count()).toBe(5);
    expect(await storedFiles()).toEqual(files);
    const hits = await db.rateLimitHit.findMany(CAREERS_HITS);
    expect(hits).toHaveLength(1);
    expect(hits[0].key).not.toContain(ip);
  });

  it("the careers bucket is independent of the rfq bucket", async () => {
    const ip = setIp();
    for (let i = 0; i < 5; i++) {
      state.headers = new Headers({ "x-forwarded-for": ip });
      expect(
        (
          await submitContact(
            (() => {
              const fd = new FormData();
              for (const [k, v] of Object.entries({
                type: "GENERAL",
                fullName: NAME,
                companyName: "TEST Co",
                email: `m${i}@testmail.example`,
                phone: PHONE,
                country: "UK",
                message: "TEST a long enough message",
                consent: "on",
              })) {
                fd.set(k, v);
              }
              return fd;
            })(),
          )
        ).ok,
      ).toBe(true);
    }
    // The enquiry bucket is full, the careers bucket untouched.
    state.headers = new Headers({ "x-forwarded-for": ip });
    expect((await submitApplication(form())).ok).toBe(true);
    expect(await db.rateLimitHit.count(RFQ_HITS)).toBe(1);
    expect(await db.rateLimitHit.count(CAREERS_HITS)).toBe(1);
  });
});

describe("submitApplication: CV validation stores nothing on rejection", () => {
  const rejected: [string, () => FormData][] = [
    [
      "an executable renamed .pdf",
      () => form({}, new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03])], "TEST-cv.pdf", { type: "application/pdf" })),
    ],
    ["a zero-byte file", () => form({}, new File([], "TEST-empty.pdf", { type: "application/pdf" }))],
    [
      "a file of 10 MB + 1 byte",
      () => {
        const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
        bytes.set(new TextEncoder().encode("%PDF-1.4\n"));
        return form({}, new File([bytes], "TEST-big.pdf", { type: "application/pdf" }));
      },
    ],
    [
      "a .png",
      () =>
        form(
          {},
          new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], "TEST-cv.png", {
            type: "image/png",
          }),
        ),
    ],
    [
      "two files",
      () => {
        const fd = form({}, pdf("TEST-one.pdf"));
        fd.append("cv", pdf("TEST-two.pdf"));
        return fd;
      },
    ],
    ["no file", () => form({}, null)],
  ];
  for (const [label, build] of rejected) {
    it(`rejects ${label}`, async () => {
      setIp();
      const result = await submitApplication(build());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toHaveProperty("cv");
      await expectNothingStored();
      expect(state.sent).toEqual([]);
    });
  }

  it("a missing CV says 'Attach your CV'", async () => {
    setIp();
    expect(await submitApplication(form({}, null))).toEqual({ ok: false, errors: { cv: ["Attach your CV"] } });
  });

  it("a file in the wrong field is ignored, so it counts as no CV", async () => {
    setIp();
    const fd = form({}, null);
    fd.append("attachments", pdf());
    const result = await submitApplication(fd);
    expect(result.ok).toBe(false);
    await expectNothingStored();
  });

  it("missing consent and bad email are field errors and store nothing", async () => {
    setIp();
    const result = await submitApplication(form({ consent: "", email: "nope" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["consent", "email"]);
    await expectNothingStored();
    expect(await db.rateLimitHit.count()).toBe(0);
  });

  it("a failure after the object is stored leaves no object and no row", async () => {
    silence();
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_fail_application_file() RETURNS trigger AS $$
      BEGIN
        IF NEW."filename" = 'TEST-FAIL.pdf' THEN
          RAISE EXCEPTION 'TEST forced file failure';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER test_fail_application_file BEFORE INSERT ON "application_file"
      FOR EACH ROW EXECUTE FUNCTION test_fail_application_file()`);
    try {
      setIp();
      const result = await submitApplication(form({}, pdf("TEST-FAIL.pdf")));
      expect(result).toEqual({
        ok: false,
        errors: { form: "We could not submit your enquiry. Please try again in a few minutes." },
      });
      await expectNothingStored();
      expect(state.sent).toEqual([]);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_application_file ON "application_file"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_application_file()`);
    }
  });
});

describe("submitApplication: emails and privacy", () => {
  it("the acknowledgement has the reference and none of the typed values; the internal one has the details", async () => {
    await makeJob("chemist");
    setIp();
    const result = await submitApplication(
      form({
        fullName: "Claim your refund at evil-name.example/r now",
        country: "TEST-Country text",
        message: "TEST-Message <b>click</b> evil.example",
        job: "chemist",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ack = state.sent.find((m) => m.to.includes(CANDIDATE));
    expect(ack).toBeDefined();
    expect(ack!.subject).toBe(`We received your application ${result.reference}`);
    const ackAll = `${ack!.subject}\n${ack!.html}\n${ack!.text}`;
    expect(ackAll).toContain(result.reference);
    for (const secret of [
      "Claim your refund",
      "evil-name.example",
      "TEST-Country",
      "TEST-Message",
      "evil.example",
      PHONE,
      "Casey",
      CANDIDATE,
      "TEST Title",
      "TEST-cv.pdf",
    ]) {
      expect(ackAll).not.toContain(secret);
    }

    const internal = state.sent.find((m) => m.to.includes(HR));
    expect(internal?.to).toEqual([HR]);
    expect(internal?.subject).toBe(`New job application ${result.reference}`);
    for (const wanted of ["evil-name.example", CANDIDATE, PHONE, "TEST-Country", "TEST-Message", "TEST Title chemist", "TEST-cv.pdf"]) {
      expect(internal?.text).toContain(wanted);
    }
    expect(internal?.html).toContain("TEST-Message &lt;b&gt;click&lt;/b&gt;");
    expect(state.sent).toHaveLength(2);
  });

  it("with no recipients configured the application is still stored and the candidate acknowledged", async () => {
    const spies = silence();
    await db.siteSetting.deleteMany();
    setIp();
    const result = await submitApplication(form());
    expect(result.ok).toBe(true);
    expect(await db.jobApplication.count()).toBe(1);
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to).toEqual([CANDIDATE]);
    expect(String(spies.warn.mock.calls[0][0])).toContain("[careers]");
  });

  it("records email outcomes as AuditLog rows holding the kind and recipient count only", async () => {
    setIp();
    const result = await submitApplication(form());
    expect(result.ok).toBe(true);
    const app = await db.jobApplication.findFirstOrThrow();
    const rows = await db.auditLog.findMany({ where: { action: "application.email" } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.entityType).toBe("application");
      expect(row.entityId).toBe(app.id);
      expect(row.outcome).toBe("ok");
    }
    expect(rows.map((r) => r.detail).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual([
      { kind: "acknowledgement", recipients: 1 },
      { kind: "internal", recipients: 1 },
    ]);
    // No EnquiryActivity row exists for an application.
    expect(await db.enquiryActivity.count()).toBe(0);
  });

  it("an email failure is audited without its error text and never fails the submission", async () => {
    const spies = silence();
    // Make every send throw by breaking the capturing provider's sink.
    const original = state.sent.push.bind(state.sent);
    state.sent.push = () => {
      throw new Error(`boom for ${CANDIDATE} ${NAME}`);
    };
    try {
      setIp();
      const result = await submitApplication(form());
      expect(result.ok).toBe(true);
    } finally {
      state.sent.push = original;
    }
    const rows = await db.auditLog.findMany({ where: { action: "application.email" } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.outcome).toBe("rejected");
      expect(Object.keys(row.detail as object)).toEqual(["kind"]);
    }
    expect(JSON.stringify(spies.error.mock.calls)).not.toContain(CANDIDATE);
  });

  it("no AuditLog row and no console output contains the email, name or phone", async () => {
    const spies = silence();
    await makeJob("chemist");
    setIp();
    expect((await submitApplication(form({ job: "chemist" }))).ok).toBe(true);
    // A second one with no recipients exercises the warning path too.
    await db.siteSetting.deleteMany();
    expect((await submitApplication(form({ email: "other@testmail.example" }))).ok).toBe(true);
    const audit = JSON.stringify(await db.auditLog.findMany());
    const output = JSON.stringify([
      spies.log.mock.calls,
      spies.warn.mock.calls,
      spies.error.mock.calls,
    ]);
    for (const secret of [CANDIDATE, "other@testmail.example", "Casey", "TEST Casey", PHONE, "evil.example", "TEST-cv"]) {
      expect(audit).not.toContain(secret);
      expect(output).not.toContain(secret);
    }
  });
});
