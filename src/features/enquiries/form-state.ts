import { ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_BYTES } from "@/features/enquiries/attachment-rules";
import { MAX_ATTACHMENTS, rfqToFormData, type RfqInput } from "@/features/enquiries/schema";

/**
 * Client-side form state for the RFQ form and its mapping to the FormData the
 * submitRfq server action parses (rfqFromFormData). Isomorphic and pure, so
 * tests/unit/rfq-form-data.test.ts can prove client and server never drift.
 */

/** React Hook Form values: exactly the schema input. Display-only data (CAS) lives outside. */
export type RfqFormValues = RfqInput;
export type RfqLineValues = RfqInput["items"][number];

/** A free-text line: no product id, editable name. */
export function emptyLine(): RfqLineValues {
  return { name: "", quantity: "", unit: "KG", notes: "" };
}

/** A line for a saved catalogue product; the name is shown read-only and re-resolved on the server. */
export function catalogueLine(product: { id: string; name: string }): RfqLineValues {
  return { productId: product.id, name: product.name, quantity: "", unit: "KG", notes: "" };
}

/**
 * FormData for submitRfq: scalar fields by name, lines as items.<i>.<field>,
 * consent as "on", files under "attachments", plus the form instance's
 * idempotency token.
 */
export function buildRfqFormData(values: RfqFormValues, submissionId: string, files: readonly File[]): FormData {
  const items = values.items.map((item) => {
    const line: RfqLineValues = { name: item.name, quantity: item.quantity, unit: item.unit, notes: item.notes };
    if (item.productId) line.productId = item.productId;
    return line;
  });
  return rfqToFormData({ ...values, items, submissionId }, files);
}

export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * Courtesy checks before upload (type by extension, size, count). The server
 * also sniffs content and remains the authority.
 */
export function checkSelectedFiles(
  existing: readonly File[],
  incoming: readonly File[],
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];
  const overflow: string[] = [];
  for (const file of incoming) {
    if ([...existing, ...accepted].some((f) => sameFile(f, file))) continue;
    if (!ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name))) {
      errors.push(`${file.name}: this file type is not accepted`);
    } else if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.push(`${file.name}: larger than 10 MB`);
    } else if (file.size === 0) {
      errors.push(`${file.name}: the file is empty`);
    } else if (existing.length + accepted.length >= MAX_ATTACHMENTS) {
      overflow.push(file.name);
    } else {
      accepted.push(file);
    }
  }
  if (overflow.length) errors.push(`You can attach up to ${MAX_ATTACHMENTS} files. Not added: ${overflow.join(", ")}`);
  return { accepted, errors };
}

/** "1.2 MB", "340 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
