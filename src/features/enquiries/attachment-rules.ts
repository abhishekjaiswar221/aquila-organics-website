export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;
const DEFAULT_STEM = "attachment";

type Kind = "pdf" | "png" | "jpeg" | "zip" | "text";

const EXTENSIONS: Record<string, { mimeType: string; kind: Kind }> = {
  pdf: { mimeType: "application/pdf", kind: "pdf" },
  png: { mimeType: "image/png", kind: "png" },
  jpg: { mimeType: "image/jpeg", kind: "jpeg" },
  jpeg: { mimeType: "image/jpeg", kind: "jpeg" },
  docx: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "zip",
  },
  xlsx: {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "zip",
  },
  csv: { mimeType: "text/csv", kind: "text" },
};

/** Allowed extensions (lower case, no dot), for client-side hints. The server check is authoritative. */
export const ATTACHMENT_EXTENSIONS: readonly string[] = Object.keys(EXTENSIONS);

export type AttachmentResult =
  | { ok: true; mimeType: string; safeName: string }
  | { ok: false; reason: string };

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
}

function sniff(bytes: Uint8Array): Kind | "other" {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  return "other";
}

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(needle, 0, "latin1");
}

function isCleanUtf8Text(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    // NUL and other C0 controls (except tab, LF, CR) and DEL: not CSV text.
    if ((b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f) return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

const CONTROL_CHARS = new RegExp(
  "[\u0000-\u001f\u007f-\u009f\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]",
  "g",
);

function sanitiseName(raw: string): string {
  // Keep only the last path component, whichever separator was used.
  const base = raw.normalize("NFKC").split(/[\\/]/).pop() ?? "";
  return base
    .replace(CONTROL_CHARS, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateAttachment(file: {
  name: string;
  size: number;
  bytes: Uint8Array;
}): AttachmentResult {
  const { bytes } = file;
  if (bytes.length === 0 || file.size === 0) return { ok: false, reason: "File is empty" };
  if (bytes.length > MAX_ATTACHMENT_BYTES || file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: "File is larger than 10 MB" };
  }
  if (file.size !== bytes.length) return { ok: false, reason: "File size mismatch" };

  // Trailing dots/spaces are ignored by Windows, so they must not hide an extension.
  const cleaned = sanitiseName(file.name).replace(/[. ]+$/, "");
  const dot = cleaned.lastIndexOf(".");
  if (dot < 0 || dot === cleaned.length - 1) {
    return { ok: false, reason: "File type is not allowed" };
  }
  const ext = cleaned.slice(dot + 1).toLowerCase();
  const rule = Object.hasOwn(EXTENSIONS, ext) ? EXTENSIONS[ext] : undefined;
  if (!rule) return { ok: false, reason: "File type is not allowed" };

  const sniffed = sniff(bytes);
  if (rule.kind === "text") {
    if (sniffed !== "other" || !isCleanUtf8Text(bytes)) {
      return { ok: false, reason: "File content is not valid CSV text" };
    }
  } else if (sniffed !== rule.kind) {
    return { ok: false, reason: "File content does not match its extension" };
  }
  if (rule.kind === "zip") {
    // The part names appear uncompressed in the ZIP headers/central directory.
    const marker = ext === "docx" ? "word/" : "xl/";
    if (!containsAscii(bytes, marker)) {
      return { ok: false, reason: "File content does not match its extension" };
    }
  }

  let stem = cleaned
    .slice(0, dot)
    .replace(/^[. ]+|[. ]+$/g, "")
    .trim();
  if (!stem) stem = DEFAULT_STEM;
  const suffix = `.${ext}`;
  stem = [...stem].slice(0, MAX_NAME_LENGTH - suffix.length).join("").trim() || DEFAULT_STEM;
  return { ok: true, mimeType: rule.mimeType, safeName: `${stem}${suffix}` };
}
