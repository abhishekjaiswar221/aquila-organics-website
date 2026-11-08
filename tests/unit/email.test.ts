// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  acknowledgementEmail,
  internalNotificationEmail,
} from "@/lib/email/templates";
import { DevEmailProvider } from "@/lib/email/dev";

const base = {
  reference: "AQ-2026-000123",
  fullName: "<script>alert(1)</script>",
  items: [{ name: "Rose <b>oil</b> & co", quantity: "5", unit: "kg" }],
};

describe("acknowledgementEmail", () => {
  it("escapes user strings in html and keeps the reference", () => {
    const m = acknowledgementEmail(base);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("Rose &lt;b&gt;oil&lt;/b&gt; &amp; co");
    expect(m.html).toContain(base.reference);
    expect(m.text).toContain(base.reference);
    expect(m.subject).toContain(base.reference);
    expect(m.text).toContain("Rose <b>oil</b> & co");
    expect(m.text).toContain("5 kg");
  });
  it("escapes quotes", () => {
    const m = acknowledgementEmail({ ...base, fullName: `" onload="x` });
    expect(m.html).not.toContain(`" onload="x`);
  });
  it("strips CR/LF from the subject", () => {
    const m = acknowledgementEmail({ ...base, reference: "AQ-1\r\nBcc: evil@x.com" });
    expect(m.subject).not.toMatch(/[\r\n]/);
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
  it("strips CRLF from a subject built from the name", () => {
    const m = internalNotificationEmail({ ...base, fullName: "A\r\nBcc: x@y.z" });
    expect(m.subject).not.toMatch(/[\r\n]/);
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
