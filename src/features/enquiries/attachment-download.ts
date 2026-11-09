import {
  contentDispositionAttachment,
  downloadFilename,
  safeDocumentContentType,
} from "@/features/products/document-download";

const SPREADSHEET_TYPES = new Set([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/** Spreadsheet files can carry formulas: the admin UI warns next to them. */
export function isSpreadsheetAttachment(mimeType: string): boolean {
  return SPREADSHEET_TYPES.has(mimeType.trim().toLowerCase());
}

/**
 * Response headers for an enquiry attachment download. Shares the product
 * document sanitiser and content-type allow-list (stored values are treated as
 * untrusted), always downloads (never renders inline), and is never cached.
 */
export function attachmentDownloadHeaders(file: {
  id: string;
  filename: string;
  mimeType: string;
}): Record<string, string> {
  return {
    "Content-Type": safeDocumentContentType(file.mimeType),
    "Content-Disposition": contentDispositionAttachment(downloadFilename(file.filename, file.id, file.mimeType)),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
