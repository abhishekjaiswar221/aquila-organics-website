import { beforeEach, describe, expect, it } from "vitest";
import { getPublishedDocumentFile, getPublishedSitemapEntries } from "@/features/products/queries";
import { db, resetDb } from "./setup";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

async function makeProduct(slug: string, status: Status, publishedAt: Date | null = null) {
  return db.product.create({
    data: {
      name: `TEST-${slug}`,
      slug,
      status,
      verified: status === "PUBLISHED",
      publishedAt: status === "PUBLISHED" ? (publishedAt ?? new Date()) : null,
    },
  });
}

async function makeDocument(productId: string, storageKey: string) {
  return db.productDocument.create({
    data: { productId, kind: "DATASHEET", title: "TEST datasheet", storageKey, mimeType: "application/pdf" },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("getPublishedSitemapEntries", () => {
  it("returns slug and last-modified for published products only, in slug order", async () => {
    await makeProduct("test-b", "PUBLISHED");
    await makeProduct("test-a", "PUBLISHED");
    await makeProduct("test-draft", "DRAFT");
    await makeProduct("test-archived", "ARCHIVED");

    const entries = await getPublishedSitemapEntries();
    expect(entries.map((e) => e.slug)).toEqual(["test-a", "test-b"]);
    for (const e of entries) {
      expect(e.lastModified).toBeInstanceOf(Date);
      expect(Object.keys(e).sort()).toEqual(["lastModified", "slug"]);
    }
  });
});

describe("getPublishedDocumentFile", () => {
  it("returns the file of a published product's document", async () => {
    const p = await makeProduct("test-pub", "PUBLISHED");
    const doc = await makeDocument(p.id, "key-pub");
    expect(await getPublishedDocumentFile(doc.id)).toEqual({
      id: doc.id,
      title: "TEST datasheet",
      mimeType: "application/pdf",
      storageKey: "key-pub",
    });
  });

  it("returns null for documents of draft or archived products", async () => {
    const d = await makeProduct("test-d", "DRAFT");
    const a = await makeProduct("test-a", "ARCHIVED");
    const dd = await makeDocument(d.id, "key-d");
    const ad = await makeDocument(a.id, "key-a");
    expect(await getPublishedDocumentFile(dd.id)).toBeNull();
    expect(await getPublishedDocumentFile(ad.id)).toBeNull();
  });

  it("returns null for unknown ids and non-uuids without throwing", async () => {
    expect(await getPublishedDocumentFile("00000000-0000-4000-8000-000000000000")).toBeNull();
    for (const bad of ["", "not-a-uuid", "'; DROP TABLE product; --", "\u{0000}"]) {
      expect(await getPublishedDocumentFile(bad), bad).toBeNull();
    }
  });
});
