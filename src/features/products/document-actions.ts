"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { recordAudit, recordAuditBestEffort } from "@/features/admin/audit";
import { validateAttachment, MAX_ATTACHMENT_BYTES } from "@/features/enquiries/attachment-rules";
import { cleanLine } from "@/features/enquiries/schema";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { getStorage } from "@/lib/storage";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin product documents. Each exported function is a public Server Action
 * endpoint: requireAction() first (outside any try/catch, it throws
 * redirect/forbidden), then validation of the untrusted form. Messages are
 * ours: never the file name, the path or an error message.
 *
 * Upload order: validate -> store the object under an opaque key -> insert the
 * row (with its audit row, one transaction) -> on failure delete the object.
 * A row therefore never points at a missing object. Delete order: row (and
 * audit) first, then the object; a storage failure never resurrects the row.
 */

export type DocumentFormState = { ok: boolean; message: string } | null;

const DOCUMENT_KINDS = ["DATASHEET", "SDS", "OTHER"] as const;
type DocumentKind = (typeof DOCUMENT_KINDS)[number];
const MAX_TITLE = 200;

const FAILED = "The document could not be saved. Try again.";
const NOT_FOUND = "Product not found.";

function errorClass(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

const fail = (message: string): DocumentFormState => ({ ok: false, message });

export async function uploadProductDocument(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const actor = await requireAction("documents.manage");

  const productId = normalizeUuid(formData.get("productId"));
  if (!productId) return fail(NOT_FOUND);

  const rawKind = formData.get("kind");
  const kind = DOCUMENT_KINDS.find((k) => k === rawKind) as DocumentKind | undefined;
  if (!kind) return fail("Choose a document type.");

  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? cleanLine(rawTitle) : "";
  if (title.length < 1 || title.length > MAX_TITLE) return fail(`Enter a title of 1 to ${MAX_TITLE} characters.`);

  const file = formData.get("file");
  if (typeof file === "string" || !file || file.size === 0) return fail("Choose a file to upload.");
  // Checked before reading, so an oversized upload is never buffered.
  if (file.size > MAX_ATTACHMENT_BYTES) return fail("File is larger than 10 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = validateAttachment({ name: file.name, size: file.size, bytes });
  if (!verdict.ok) return fail(`${verdict.reason}. Allowed: PDF, PNG, JPEG, CSV, DOCX and XLSX up to 10 MB.`);

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return fail(NOT_FOUND);

  // Opaque random key: no user input, unguessable, valid for every driver.
  const key = `doc-${randomBytes(32).toString("base64url")}`;
  const storage = getStorage();
  try {
    await storage.put(key, bytes, { mimeType: verdict.mimeType });
  } catch (err) {
    console.error("[admin] document store failed:", errorClass(err));
    return fail(FAILED);
  }

  try {
    await db.$transaction(async (tx) => {
      const created = await tx.productDocument.create({
        data: { productId, kind, title, storageKey: key, mimeType: verdict.mimeType },
        select: { id: true },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "document.upload",
          entityType: "document",
          entityId: created.id,
          outcome: "ok",
          detail: { kind },
        },
        tx,
      );
    });
  } catch (err) {
    console.error("[admin] document save failed:", errorClass(err));
    await storage.delete(key).catch((cleanupErr: unknown) => {
      console.error("[admin] could not remove an object after a failed document save:", errorClass(cleanupErr));
    });
    return fail(FAILED);
  }
  refresh();
  return { ok: true, message: "Document uploaded." };
}

export async function deleteProductDocument(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const actor = await requireAction("documents.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return fail("Document not found.");

  let removed: { id: string; storageKey: string; kind: string } | null;
  try {
    removed = await db.$transaction(async (tx) => {
      const doc = await tx.productDocument.findUnique({
        where: { id },
        select: { id: true, storageKey: true, kind: true },
      });
      if (!doc) return null;
      await tx.productDocument.delete({ where: { id } });
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "document.delete",
          entityType: "document",
          entityId: doc.id,
          outcome: "ok",
          detail: { kind: doc.kind },
        },
        tx,
      );
      return doc;
    });
  } catch (err) {
    console.error("[admin] document delete failed:", errorClass(err));
    return fail("The document could not be deleted. Try again.");
  }
  if (!removed) return fail("Document not found.");

  try {
    await getStorage().delete(removed.storageKey);
  } catch (err) {
    console.error("[admin] document object removal failed:", errorClass(err));
    await recordAuditBestEffort({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "document.delete",
      entityType: "document",
      entityId: removed.id,
      outcome: "ok",
      detail: { storageCleanup: "failed" },
    });
  }
  refresh();
  return { ok: true, message: "Document deleted." };
}
