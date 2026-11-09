import { describe, expect, it } from "vitest";
import { attachmentDownloadHeaders, isSpreadsheetAttachment } from "@/features/enquiries/attachment-download";

const ID = "00000000-0000-4000-8000-0000000000aa";

describe("attachmentDownloadHeaders", () => {
  it("serves an allow-listed type as an attachment with locked-down headers", () => {
    const h = attachmentDownloadHeaders({ id: ID, filename: "TEST-spec.pdf", mimeType: "application/pdf" });
    expect(h).toEqual({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="TEST-spec.pdf"; filename*=UTF-8''TEST-spec.pdf`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Robots-Tag": "noindex, nofollow",
    });
  });

  it("serves CSV as text/csv, still as an attachment", () => {
    const h = attachmentDownloadHeaders({ id: ID, filename: "prices.csv", mimeType: "text/csv" });
    expect(h["Content-Type"]).toBe("text/csv");
    expect(h["Content-Disposition"]).toMatch(/^attachment; /);
  });

  it("downgrades unexpected stored types to octet-stream", () => {
    for (const t of ["text/html", "image/svg+xml", "application/javascript", ""]) {
      expect(attachmentDownloadHeaders({ id: ID, filename: "x", mimeType: t })["Content-Type"]).toBe(
        "application/octet-stream",
      );
    }
  });

  it("reuses the document filename sanitiser: no CR, LF, quotes or path parts in the header", () => {
    const h = attachmentDownloadHeaders({
      id: ID,
      filename: 'evil"\r\nSet-Cookie: x=1\\..\\/name.pdf',
      mimeType: "application/pdf",
    });
    const cd = h["Content-Disposition"];
    expect(cd).not.toMatch(/[\r\n]/);
    const plain = /filename="([^"]*)"/.exec(cd)?.[1] ?? "";
    expect(plain).not.toMatch(/["\\/]/);
    expect(cd).toMatch(/filename\*=UTF-8''[A-Za-z0-9%._~!-]+$/);
  });

  it("keeps non-ASCII names in filename* and falls back to the id when nothing is left", () => {
    const h = attachmentDownloadHeaders({ id: ID, filename: "Spécification.pdf", mimeType: "application/pdf" });
    expect(h["Content-Disposition"]).toContain(`filename="Sp_cification.pdf"`);
    expect(h["Content-Disposition"]).toContain("filename*=UTF-8''Sp%C3%A9cification.pdf");
    const empty = attachmentDownloadHeaders({ id: ID, filename: '""', mimeType: "application/pdf" });
    expect(empty["Content-Disposition"]).toContain(`filename="document-${ID}.pdf"`);
  });
});

describe("isSpreadsheetAttachment", () => {
  it("flags CSV and XLSX, which can carry formulas", () => {
    expect(isSpreadsheetAttachment("text/csv")).toBe(true);
    expect(isSpreadsheetAttachment("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isSpreadsheetAttachment("application/pdf")).toBe(false);
  });
});
