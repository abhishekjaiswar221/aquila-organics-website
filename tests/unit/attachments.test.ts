// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateAttachment } from "@/features/enquiries/attachment-rules";

const enc = (s: string) => new TextEncoder().encode(s);
const pdf = () => enc("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const png = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const zipWith = (entry: string) =>
  new Uint8Array([
    0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0,
    ...enc(entry),
    0x50, 0x4b, 0x01, 0x02,
  ]);

function check(name: string, bytes: Uint8Array) {
  return validateAttachment({ name, size: bytes.length, bytes });
}

describe("validateAttachment accepts", () => {
  it("a valid PDF", () => {
    expect(check("spec.pdf", pdf())).toEqual({
      ok: true,
      mimeType: "application/pdf",
      safeName: "spec.pdf",
    });
  });
  it("a valid PNG", () => {
    const r = check("pic.PNG", png());
    expect(r).toMatchObject({ ok: true, mimeType: "image/png" });
  });
  it("jpg and jpeg", () => {
    expect(check("a.jpg", jpg())).toMatchObject({ ok: true, mimeType: "image/jpeg" });
    expect(check("a.jpeg", jpg())).toMatchObject({ ok: true, mimeType: "image/jpeg" });
  });
  it("docx and xlsx", () => {
    expect(check("a.docx", zipWith("word/document.xml"))).toMatchObject({
      ok: true,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(check("a.xlsx", zipWith("xl/workbook.xml"))).toMatchObject({
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  });
  it("a UTF-8 csv", () => {
    expect(check("a.csv", enc("name,qty\nCaf\u{e9},5\n"))).toMatchObject({
      ok: true,
      mimeType: "text/csv",
    });
  });
});

describe("validateAttachment rejects", () => {
  it("a dangerous final extension", () => {
    expect(check("invoice.pdf.exe", pdf())).toEqual({
      ok: false,
      reason: "File type is not allowed",
    });
  });
  it("a missing or unknown extension", () => {
    expect(check("noext", pdf()).ok).toBe(false);
    expect(check("a.txt", enc("hello")).ok).toBe(false);
  });
  it("a PDF-named file with MZ bytes", () => {
    expect(check("a.pdf", enc("MZ\x90\x00\x03\x00")).ok).toBe(false);
  });
  it("a PNG named a.jpg", () => {
    expect(check("a.jpg", png()).ok).toBe(false);
  });
  it("a ZIP named a.pdf", () => {
    expect(check("a.pdf", zipWith("word/document.xml")).ok).toBe(false);
  });
  it("a docx-named zip without word/ entries", () => {
    expect(check("a.docx", zipWith("evil.exe")).ok).toBe(false);
    expect(check("a.xlsx", zipWith("word/document.xml")).ok).toBe(false);
  });
  it("a csv with NUL bytes", () => {
    expect(check("a.csv", enc("a,b\n1,\x002\n")).ok).toBe(false);
  });
  it("a csv that is really a PDF, PNG or ZIP", () => {
    expect(check("a.csv", pdf()).ok).toBe(false);
    expect(check("a.csv", png()).ok).toBe(false);
    expect(check("a.csv", zipWith("x")).ok).toBe(false);
  });
  it("a csv with invalid UTF-8", () => {
    expect(check("a.csv", new Uint8Array([0x61, 0x2c, 0xff, 0xfe, 0x0a])).ok).toBe(false);
  });
  it("an empty file", () => {
    expect(check("a.pdf", new Uint8Array(0)).ok).toBe(false);
  });
  it("an 11 MB file", () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set(pdf());
    expect(check("big.pdf", big).ok).toBe(false);
  });
  it("a declared size that disagrees with the bytes", () => {
    expect(validateAttachment({ name: "a.pdf", size: 5, bytes: pdf() }).ok).toBe(false);
  });
  it("a name made only of dots and spaces", () => {
    expect(check(" . .. . ", pdf()).ok).toBe(false);
    expect(check("....", pdf()).ok).toBe(false);
  });
});

describe("validateAttachment inner dots", () => {
  it("accepts names with dots and domain-like or html-like inner parts", () => {
    for (const n of ["aquila.com.pdf", "www.supplier.com.pdf", "page.html.pdf", "report.v2.final.pdf", "invoice.exe.pdf"]) {
      expect(check(n, pdf())).toEqual({ ok: true, mimeType: "application/pdf", safeName: n });
    }
  });
  it("still validates bytes for such names", () => {
    expect(check("invoice.exe.pdf", enc("MZ\u{90}\u{0}"))).toEqual({
      ok: false,
      reason: "File content does not match its extension",
    });
  });
});

describe("validateAttachment name sanitising", () => {
  it("removes bidi override characters", () => {
    expect(check("x\u{202e}exe.pdf", pdf())).toMatchObject({ ok: true, safeName: "xexe.pdf" });
  });
  it("removes zero-width characters", () => {
    expect(check("invoice.e\u{200b}xe.pdf", pdf())).toMatchObject({ ok: true, safeName: "invoice.exe.pdf" });
    expect(check("\u{feff}a\u{2060}b.pdf", pdf())).toMatchObject({ ok: true, safeName: "ab.pdf" });
  });
  it("NFKC-normalises a fullwidth dot before extension logic", () => {
    expect(check("invoice\u{ff0e}exe.pdf", pdf())).toMatchObject({ ok: true, safeName: "invoice.exe.pdf" });
    expect(check("invoice.pdf\u{ff0e}exe", pdf())).toEqual({ ok: false, reason: "File type is not allowed" });
  });
  it("falls back to the default stem for invisible-only stems", () => {
    expect(check("\u{200b}\u{202e}\u{feff}.pdf", pdf())).toMatchObject({ ok: true, safeName: "attachment.pdf" });
    expect(check("\u{200b}\u{202e}\u{feff}", pdf())).toEqual({ ok: false, reason: "File type is not allowed" });
  });
  it("caps by code points without splitting surrogate pairs", () => {
    const r = check(`a${"\u{1f600}".repeat(200)}.pdf`, pdf());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect([...r.safeName].length).toBeLessThanOrEqual(120);
      expect(r.safeName.endsWith(".pdf")).toBe(true);
      expect(r.safeName.isWellFormed()).toBe(true);
    }
  });
  it("reduces path components to the base name", () => {
    const r = check("../../x.pdf", pdf());
    expect(r).toMatchObject({ ok: true, safeName: "x.pdf" });
    const w = check("C:\\Users\\bob\\y.pdf", pdf());
    expect(w).toMatchObject({ ok: true, safeName: "y.pdf" });
  });
  it("strips control chars and collapses whitespace", () => {
    const r = check("my \t\u0000 \n report\u0007.pdf", pdf());
    expect(r).toMatchObject({ ok: true, safeName: "my report.pdf" });
  });
  it("caps long names at 120 chars and keeps the extension", () => {
    const r = check(`${"a".repeat(300)}.pdf`, pdf());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.safeName.length).toBeLessThanOrEqual(120);
      expect(r.safeName.endsWith(".pdf")).toBe(true);
    }
  });
  it("falls back to a default stem when only the extension remains", () => {
    const r = check("...\u0001.pdf", pdf());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.safeName).toBe("attachment.pdf");
  });
  it("never returns path separators", () => {
    const r = check("a/b\\c:d*e.pdf", pdf());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.safeName).not.toMatch(/[\\/:*]/);
  });
});

describe("validateAttachment with an extension allow-list (careers CV: pdf, docx)", () => {
  const cv = (name: string, bytes: Uint8Array) =>
    validateAttachment({ name, size: bytes.length, bytes }, ["pdf", "docx"]);
  it("accepts a PDF and a DOCX", () => {
    expect(cv("cv.pdf", pdf())).toMatchObject({ ok: true, mimeType: "application/pdf" });
    expect(cv("cv.docx", zipWith("word/document.xml"))).toMatchObject({ ok: true });
  });
  it("rejects a correctly built PNG, CSV and XLSX", () => {
    expect(cv("cv.png", png())).toEqual({ ok: false, reason: "File type is not allowed" });
    expect(cv("cv.csv", enc("a,b\n1,2\n"))).toEqual({ ok: false, reason: "File type is not allowed" });
    expect(cv("cv.xlsx", zipWith("xl/workbook.xml"))).toEqual({ ok: false, reason: "File type is not allowed" });
  });
  it("still checks content: a PNG named .pdf and an empty file are rejected", () => {
    expect(cv("cv.pdf", png())).toMatchObject({ ok: false });
    expect(cv("cv.pdf", new Uint8Array())).toMatchObject({ ok: false });
  });
  it("the default (no list) still allows every known extension", () => {
    expect(check("a.png", png())).toMatchObject({ ok: true });
    expect(check("a.csv", enc("a,b\n"))).toMatchObject({ ok: true });
  });
});
