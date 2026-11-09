import type { DefaultValues } from "react-hook-form";
import { ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_BYTES } from "@/features/enquiries/attachment-rules";
import { MAX_ATTACHMENTS, rfqToFormData, type RfqInput } from "@/features/enquiries/schema";

/**
 * Client-side form state for the RFQ form and its mapping to the FormData the
 * submitRfq server action parses (rfqFromFormData). Isomorphic and pure, so
 * tests/unit/rfq-form-data.test.ts can prove client and server never drift.
 */

type SchemaLine = RfqInput["items"][number];

/**
 * One line in the form. Identical to the schema input except that the unit
 * may still be "" (nothing chosen yet): the unit is an explicit choice, never
 * a silent default, and rfqSchema rejects "" with "Choose a unit" on both the
 * client and the server.
 */
export type RfqLineValues = Omit<SchemaLine, "unit"> & { unit: SchemaLine["unit"] | "" };

/**
 * React Hook Form values. Display-only data (CAS) lives outside. Consent may be
 * false while the box is unticked (and after a reset); rfqSchema requires true.
 */
export type RfqFormValues = Omit<RfqInput, "items" | "consent"> & { items: RfqLineValues[]; consent: boolean };

/** A free-text line: no product id, editable name, no unit chosen. */
export function emptyLine(): RfqLineValues {
  return { name: "", quantity: "", unit: "", notes: "" };
}

/** A line for a saved catalogue product; the name is shown read-only and re-resolved on the server. */
export function catalogueLine(product: { id: string; name: string }): RfqLineValues {
  return { productId: product.id, name: product.name, quantity: "", unit: "", notes: "" };
}

/** The form's starting values (also used to reset it after a successful send). */
export function pristineValues(): DefaultValues<RfqFormValues> {
  return {
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    country: "",
    intendedApplication: "",
    additionalRequirements: "",
    consent: false,
    items: [],
  };
}

function isBlankLine(line: RfqLineValues): boolean {
  return (
    !line.productId &&
    !line.name.trim() &&
    String(line.quantity ?? "").trim() === "" &&
    line.unit === "" &&
    !(line.notes ?? "").trim()
  );
}

/**
 * Merges the visitor's saved catalogue products into the current lines
 * without dropping or changing anything typed: products already present are
 * skipped, new ones are appended. A form with no lines (or only one untouched
 * blank line) is replaced by the saved products, or one blank line if none.
 * Idempotent, so repeated effect runs (StrictMode, Activity) are harmless.
 */
export function mergeSavedLines(
  current: readonly RfqLineValues[],
  products: readonly { id: string; name: string }[],
): { mode: "replace" | "append" | "none"; lines: RfqLineValues[] } {
  const present = new Set(current.flatMap((l) => (l.productId ? [l.productId.toLowerCase()] : [])));
  const added = products.filter((p) => !present.has(p.id.toLowerCase())).map(catalogueLine);
  const untouched = current.length === 0 || (current.length === 1 && isBlankLine(current[0]));
  if (untouched) {
    if (added.length) return { mode: "replace", lines: added };
    return current.length === 0 ? { mode: "replace", lines: [emptyLine()] } : { mode: "none", lines: [] };
  }
  return added.length ? { mode: "append", lines: added } : { mode: "none", lines: [] };
}

/**
 * FormData for submitRfq: scalar fields by name, lines as items.<i>.<field>,
 * consent as "on", files under "attachments", plus the form instance's
 * idempotency token.
 */
export function buildRfqFormData(values: RfqFormValues, submissionId: string, files: readonly File[]): FormData {
  const items = values.items.map((item) => {
    // An unchosen unit is sent as "" and rejected by the server's schema.
    const line: SchemaLine = {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit as SchemaLine["unit"],
      notes: item.notes,
    };
    if (item.productId) line.productId = item.productId;
    return line;
  });
  // Unticked consent is simply not sent (rfqToFormData sends "on" only for true).
  return rfqToFormData({ ...values, consent: values.consent as true, items, submissionId }, files);
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
