import { describe, expect, it } from "vitest";
import {
  contentDispositionAttachment,
  downloadFilename,
  safeDocumentContentType,
} from "@/features/products/document-download";

const ID = "00000000-0000-4000-8000-0000000000aa";

describe("safeDocumentContentType", () => {
  it("passes allow-listed types through, normalised", () => {
    expect(safeDocumentContentType("application/pdf")).toBe("application/pdf");
    expect(safeDocumentContentType(" Image/PNG ")).toBe("image/png");
    expect(safeDocumentContentType("image/jpeg")).toBe("image/jpeg");
  });

  it("downgrades anything else to octet-stream", () => {
    for (const t of ["text/html", "image/svg+xml", "application/javascript", "application/pdf; x=\"<\"", "", "text/xml"]) {
      expect(safeDocumentContentType(t), t).toBe("application/octet-stream");
    }
  });
});

describe("downloadFilename", () => {
  it("keeps a plain title and adds the extension for its type", () => {
    expect(downloadFilename("TEST-Ethanol datasheet", ID, "application/pdf")).toBe("TEST-Ethanol datasheet.pdf");
  });

  it("does not double an extension already present", () => {
    expect(downloadFilename("sheet.PDF", ID, "application/pdf")).toBe("sheet.PDF");
  });

  it("removes CR, LF, quotes, slashes and other control or reserved characters", () => {
    const name = downloadFilename("a\r\nSet-Cookie: x=\"1\"\\/..\t<b>;", ID, "application/pdf");
    expect(name).not.toMatch(/[\r\n"\\/\t<>;:\u0000-\u001f]/);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("falls back to the id when nothing usable is left", () => {
    expect(downloadFilename("\r\n\"\"", ID, "application/pdf")).toBe(`document-${ID}.pdf`);
    expect(downloadFilename("...", ID, "application/octet-stream")).toBe(`document-${ID}`);
  });

  it("caps the length", () => {
    expect(downloadFilename("x".repeat(400), ID, "application/pdf").length).toBeLessThanOrEqual(124);
  });
});

describe("contentDispositionAttachment", () => {
  it("is an attachment with an ASCII filename and an RFC 5987 utf-8 form", () => {
    const header = contentDispositionAttachment("R\u{00E9}sum\u{00E9} \u{2265} 99.pdf");
    expect(header.startsWith("attachment; ")).toBe(true);
    expect(header).toContain('filename="R_sum_ _ 99.pdf"');
    expect(header).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9%20%E2%89%A5%2099.pdf");
    expect(header).not.toMatch(/[\r\n]/);
  });
});
