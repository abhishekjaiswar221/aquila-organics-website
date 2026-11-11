/** Every note written by the legacy import (data/legacy-products.json) starts with this. */
export const IMPORT_NOTE_PREFIX = "CAS as listed on legacy site";

export function isImportedNote(note: string | null | undefined): boolean {
  return typeof note === "string" && note.startsWith(IMPORT_NOTE_PREFIX);
}
