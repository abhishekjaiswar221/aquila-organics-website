import "server-only";
import { db } from "@/lib/db";
import { normalizeUuid } from "@/lib/uuid";

export type DocumentFile = { id: string; title: string; mimeType: string; storageKey: string };

/**
 * Document download route only: a document together with its storage key, but
 * only when it belongs to a published product. The key is used to open the
 * stream and must never be sent to a browser, so this module is server-only
 * (importing it from a client component fails the build).
 */
export async function getPublishedDocumentFile(id: string): Promise<DocumentFile | null> {
  const normalised = normalizeUuid(id);
  if (!normalised) return null;
  return db.productDocument.findFirst({
    where: { id: normalised, product: { status: "PUBLISHED" } },
    select: { id: true, title: true, mimeType: true, storageKey: true },
  });
}
