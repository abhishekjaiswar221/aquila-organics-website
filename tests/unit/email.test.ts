// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  acknowledgementEmail,
  internalMessageNotificationEmail,
  internalNotificationEmail,
  messageAcknowledgementEmail,
} from "@/lib/email/templates";
import { DevEmailProvider } from "@/lib/email/dev";

const base = {
  reference: "AQ-2026-000123",
  fullName: "<script>alert(1)</script>",
  items: [{ name: "Rose <b>oil</b> & co", quantity: "5", unit: "kg" }],
};

const ackBase = { reference: base.reference, lineCount: 2 };
const HOSTILE_NAME = "Claim your refund at evil.example/r now";

describe("acknowledgementEmail", () => {
  it("keeps the reference and the number of product lines, with a constant greeting", () => {
    const m = acknowledgementEmail(ackBase);
    expect(m.html).toContain(base.reference);
    expect(m.text).toContain(base.reference);
    expect(m.subject).toBe(`We received your enquiry ${base.reference}`);
    expect(m.html).toContain("2 product lines");
    expect(m.text).toContain("2 product lines");
    expect(m.html).toContain("<p>Dear customer,</p>");
    expect(m.text.startsWith("Dear customer,\n")).toBe(true);
    expect(acknowledgementEmail({ ...ackBase, lineCount: 1 }).text).toContain("1 product line.");
  });
  it("escapes the reference and strips CR/LF from the subject", () => {
    const m = acknowledgementEmail({ ...ackBase, reference: "AQ-1\r\nBcc: evil@x.com<b>" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.html).not.toContain("<b>");
  });
  it("never echoes the visitor's name or any other free text, even when passed in", () => {
    const everything = {
      ...ackBase,
      fullName: HOSTILE_NAME,
      items: [{ name: "TEST-Item visit evil.example", quantity: "5", unit: "kg" }],
      company: "TEST-Company call +1 555",
      notes: "TEST-Requirements click here",
      application: "TEST-Application text",
    };
    const ack = acknowledgementEmail(everything);
    const internal = internalNotificationEmail(everything);
    for (const secret of [
      HOSTILE_NAME,
      "Claim",
      "refund",
      "evil.example",
      "TEST-Item",
      "TEST-Company",
      "TEST-Requirements",
      "TEST-Application",
    ]) {
      expect(ack.html).not.toContain(secret);
      expect(ack.text).not.toContain(secret);
      expect(ack.subject).not.toContain(secret);
      // The internal notification to sales keeps the full details.
      expect(internal.text).toContain(secret);
    }
  });
  it("the internal notification keeps the visitor's name, escaped", () => {
    const internal = internalNotificationEmail({ ...base, fullName: `${HOSTILE_NAME} <b>x</b>` });
    expect(internal.html).toContain(`${HOSTILE_NAME} &lt;b&gt;x&lt;/b&gt;`);
    expect(internal.html).not.toContain("<b>x</b>");
    expect(internal.text).toContain(HOSTILE_NAME);
  });
});

describe("internalNotificationEmail", () => {
  it("escapes every user-supplied field and includes the reference", () => {
    const m = internalNotificationEmail({
      ...base,
      company: "<img src=x onerror=1>",
      email: "a@b.com<x>",
      phone: "<ph>",
      country: "<c>",
      businessSegment: "<s>",
      application: "<ap>",
      notes: "<n>\nline2",
      attachmentNames: ["<f>.pdf"],
    });
    for (const raw of ["<script>", "<img", "<x>", "<ph>", "<c>", "<s>", "<ap>", "<n>", "<f>"]) {
      expect(m.html).not.toContain(raw);
    }
    expect(m.html).toContain(base.reference);
    expect(m.text).toContain(base.reference);
    expect(m.text).toContain("<f>.pdf");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
  it("strips NEL, VT, FF and NUL from subjects", () => {
    const m = internalNotificationEmail({ ...base, fullName: "A\u{85}B\u{b}C\u{c}D\u{0}E" });
    expect(m.subject).toBe("New enquiry AQ-2026-000123 from A B C D E");
  });
  it("strips CRLF from a subject built from the name", () => {
    const m = internalNotificationEmail({ ...base, fullName: "A\r\nBcc: x@y.z" });
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});

describe("contact message emails", () => {
  const REF = "AQ-2026-000321";
  const hostile = {
    reference: REF,
    enquiryType: "Flavours",
    fullName: HOSTILE_NAME,
    company: "TEST-Company call +1 555",
    email: "jane@testfragrance.example",
    phone: "+44 20 7946 0000",
    country: "TEST-Country",
    application: "Bakery",
    message: "TEST-Message line one <b>bold</b>\nvisit evil.example & reply",
    attachmentNames: ["TEST-brief.pdf"],
  };

  it("the acknowledgement is constant apart from the reference", () => {
    const m = messageAcknowledgementEmail({ reference: REF });
    expect(m.subject).toBe(`We received your message ${REF}`);
    expect(m.text.startsWith("Dear customer,\n")).toBe(true);
    expect(m.html).toContain("<p>Dear customer,</p>");
    expect(m.text).toContain("We have received your message");
    expect(m.text).toContain(REF);
    expect(m.text).not.toContain("product line");
    // Only the reference varies.
    const other = messageAcknowledgementEmail({ reference: "AQ-2026-000999" });
    expect(other.text.replace("AQ-2026-000999", REF)).toBe(m.text);
    expect(other.html.replace("AQ-2026-000999", REF)).toBe(m.html);
  });

  it("the acknowledgement takes no visitor text even when passed some", () => {
    const m = messageAcknowledgementEmail(hostile as unknown as { reference: string });
    for (const secret of [HOSTILE_NAME, "evil.example", "TEST-Message", "TEST-Company", "TEST-Country", "Bakery"]) {
      expect(`${m.subject}${m.html}${m.text}`).not.toContain(secret);
    }
  });

  it("escapes and strips the reference in the acknowledgement", () => {
    const m = messageAcknowledgementEmail({ reference: "AQ-1\r\nBcc: evil@x.com<b>" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.html).not.toContain("<b>");
  });

  it("the internal notification carries the full message, escaped, under a constant subject", () => {
    const m = internalMessageNotificationEmail(hostile);
    expect(m.subject).toBe(`New contact message ${REF}`);
    expect(m.html).toContain("TEST-Message line one &lt;b&gt;bold&lt;/b&gt;\nvisit evil.example &amp; reply");
    expect(m.html).not.toContain("<b>bold</b>");
    expect(m.text).toContain(hostile.message);
    for (const value of [HOSTILE_NAME, "TEST-Company", "TEST-Country", "Bakery", "Flavours", "TEST-brief.pdf"]) {
      expect(m.text).toContain(value);
    }
    expect(m.text).not.toContain("Requested products");
    expect(m.html).not.toContain("<ul></ul>");
  });

  it("the internal subject never carries visitor text or line breaks", () => {
    const m = internalMessageNotificationEmail({ ...hostile, fullName: "A\r\nBcc: x@y.z", reference: "AQ-1\r\nX" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject).not.toContain("Bcc");
  });
});

describe("DevEmailProvider", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aquila-outbox-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });
  it("writes one JSON file per message and logs without the body", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const p = new DevEmailProvider(dir);
    await p.send({ to: ["a@b.com"], subject: "S\r\nX", html: "<p>SECRETBODY</p>", text: "SECRETBODY" });
    await p.send({ to: ["a@b.com"], subject: "S2", html: "h", text: "t" });
    const files = await readdir(dir);
    expect(files).toHaveLength(2);
    for (const f of files) expect(f).toMatch(/^[0-9]+-[0-9a-f-]+\.json$/);
    const first = JSON.parse(await readFile(path.join(dir, files.sort()[0]), "utf8"));
    expect(first.to).toEqual(["a@b.com"]);
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRETBODY");
  });
});
