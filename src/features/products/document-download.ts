/**
 * Response-header helpers for product document downloads. Stored metadata is
 * treated as untrusted: only allow-listed content types are passed through,
 * and filenames are reduced to a safe character set.
 */

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const FALLBACK_TYPE = "application/octet-stream";
const MAX_BASE_LENGTH = 120;

export function safeDocumentContentType(mimeType: string): string {
  const normalised = mimeType.trim().toLowerCase();
  return Object.hasOwn(EXTENSIONS, normalised) ? normalised : FALLBACK_TYPE;
}

/**
 * A filename for Content-Disposition: control characters, quotes, slashes and
 * characters reserved on common file systems become spaces; runs of spaces
 * collapse; leading/trailing dots and spaces go. Falls back to the id.
 */
export function downloadFilename(title: string, id: string, mimeType: string): string {
  const ext = EXTENSIONS[safeDocumentContentType(mimeType)];
  let base = title
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f"\\/<>:;|?*\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .trim();
  if (base === "") base = `document-${id.replace(/[^0-9a-f-]/gi, "")}`;
  if (!ext) return base;
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

/** `attachment` with an ASCII fallback name plus the RFC 5987 UTF-8 form. */
export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
