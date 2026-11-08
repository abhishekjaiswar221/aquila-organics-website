import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./setup";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let seq = 0;
function productData(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return { name: `TEST Product ${seq}`, slug: `test-product-${seq}`, ...overrides };
}

async function makeEnquiry(reference = "AQ-2026-000001") {
  return db.enquiry.create({
    data: {
      reference,
      type: "AROMA_CHEMICALS",
      fullName: "Test Person",
      email: "test@example.com",
      consentAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("database extensions and indexes", () => {
  it("has the pg_trgm extension installed", async () => {
    const rows = await db.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;
    expect(rows).toHaveLength(1);
  });

  it("has GIN trigram indexes on product name and code", async () => {
    const rows = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'product' AND indexdef ILIKE '%gin_trgm_ops%'`;
    const defs = rows.map((r) => r.indexdef).join("\n");
    expect(rows).toHaveLength(2);
    expect(defs).toMatch(/USING gin \(name gin_trgm_ops\)/);
    expect(defs).toMatch(/USING gin \(code gin_trgm_ops\)/);
  });

  it("has btree indexes on casNormalized, status and categoryId", async () => {
    const rows = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'product' AND indexdef ILIKE '%USING btree%'`;
    const defs = rows.map((r) => r.indexdef).join("\n");
    expect(defs).toMatch(/btree \("casNormalized"\)/);
    expect(defs).toMatch(/btree \(status\)/);
    expect(defs).toMatch(/btree \("categoryId"\)/);
  });
});

describe("Product constraints", () => {
  it("generates UUID ids and timestamps", async () => {
    const p = await db.product.create({ data: productData() });
    expect(p.id).toMatch(UUID);
    expect(p.createdAt).toBeInstanceOf(Date);
    expect(p.updatedAt).toBeInstanceOf(Date);
    expect(p.status).toBe("DRAFT");
    expect(p.verified).toBe(false);
  });

  it("rejects two products with the same slug", async () => {
    await db.product.create({ data: productData({ slug: "same-slug" }) });
    await expect(db.product.create({ data: productData({ slug: "same-slug" }) })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("allows many products without a code but rejects a duplicate code", async () => {
    await db.product.create({ data: productData({ code: null }) });
    await db.product.create({ data: productData({ code: null }) });
    expect(await db.product.count({ where: { code: null } })).toBe(2);

    await db.product.create({ data: productData({ code: "AQ-100" }) });
    await expect(db.product.create({ data: productData({ code: "AQ-100" }) })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("rejects a PUBLISHED product that is not verified (DB check constraint)", async () => {
    await expect(
      db.product.create({ data: productData({ status: "PUBLISHED", verified: false }) }),
    ).rejects.toThrow(/product_published_requires_verified/);
  });

  it("rejects a PUBLISHED product with an empty name", async () => {
    await expect(
      db.product.create({ data: productData({ name: "", status: "PUBLISHED", verified: true }) }),
    ).rejects.toThrow(/product_published_requires_verified/);
  });

  it("rejects publishing an unverified product by update, even via raw SQL", async () => {
    const p = await db.product.create({ data: productData() });
    await expect(
      db.product.update({ where: { id: p.id }, data: { status: "PUBLISHED" } }),
    ).rejects.toThrow(/product_published_requires_verified/);
    await expect(
      db.$executeRaw`UPDATE "product" SET status = 'PUBLISHED' WHERE id = ${p.id}::uuid`,
    ).rejects.toThrow(/product_published_requires_verified/);
  });

  it("accepts a verified PUBLISHED product", async () => {
    const p = await db.product.create({
      data: productData({ status: "PUBLISHED", verified: true, publishedAt: new Date() }),
    });
    expect(p.status).toBe("PUBLISHED");
  });

  it("cascades specifications, applications and documents when a product is deleted", async () => {
    const p = await db.product.create({
      data: {
        ...productData(),
        specifications: { create: [{ label: "Purity", value: "99%", sortOrder: 1 }] },
        applications: { create: [{ name: "Fine fragrance" }] },
        documents: {
          create: [{ kind: "SDS", title: "SDS", storageKey: "docs/k1", mimeType: "application/pdf" }],
        },
      },
    });
    await db.product.delete({ where: { id: p.id } });
    expect(await db.productSpecification.count()).toBe(0);
    expect(await db.productApplication.count()).toBe(0);
    expect(await db.productDocument.count()).toBe(0);
  });

  it("keeps a product but clears categoryId when its category is deleted", async () => {
    const c = await db.category.create({ data: { name: "Aldehydes", slug: "aldehydes" } });
    const p = await db.product.create({ data: productData({ categoryId: c.id }) });
    await db.category.delete({ where: { id: c.id } });
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.categoryId).toBeNull();
  });
});

describe("Enquiry constraints", () => {
  it("rejects a duplicate enquiry reference", async () => {
    await makeEnquiry("AQ-2026-000123");
    await expect(makeEnquiry("AQ-2026-000123")).rejects.toMatchObject({ code: "P2002" });
  });

  it("defaults status to NEW", async () => {
    const e = await makeEnquiry();
    expect(e.status).toBe("NEW");
    expect(e.id).toMatch(UUID);
  });

  it("sets EnquiryItem.productId to null on product delete and keeps the snapshot", async () => {
    const p = await db.product.create({ data: productData({ name: "Vanillin", casNumber: "121-33-5" }) });
    const e = await makeEnquiry();
    const item = await db.enquiryItem.create({
      data: {
        enquiryId: e.id,
        productId: p.id,
        productNameSnapshot: "Vanillin",
        casSnapshot: "121-33-5",
        quantity: "25.5",
        unit: "KG",
      },
    });

    await db.product.delete({ where: { id: p.id } });

    const after = await db.enquiryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.productId).toBeNull();
    expect(after.productNameSnapshot).toBe("Vanillin");
    expect(after.casSnapshot).toBe("121-33-5");
    expect(after.quantity.toString()).toBe("25.5");
  });

  it("deletes items, attachments and activity with their enquiry", async () => {
    const e = await makeEnquiry();
    await db.enquiryItem.create({
      data: { enquiryId: e.id, productNameSnapshot: "Free text", quantity: 1, unit: "OTHER" },
    });
    await db.enquiryAttachment.create({
      data: { enquiryId: e.id, filename: "spec.pdf", mimeType: "application/pdf", sizeBytes: 10, storageKey: "rfq/a" },
    });
    await db.enquiryActivity.create({ data: { enquiryId: e.id, action: "created", detail: { via: "test" } } });
    await db.enquiry.delete({ where: { id: e.id } });
    expect(await db.enquiryItem.count()).toBe(0);
    expect(await db.enquiryAttachment.count()).toBe(0);
    expect(await db.enquiryActivity.count()).toBe(0);
  });
});

describe("Auth and system tables", () => {
  it("defaults a new user's role to CONTENT_EDITOR", async () => {
    const u = await db.user.create({ data: { name: "Test User", email: "user@example.com" } });
    expect(u.role).toBe("CONTENT_EDITOR");
    expect(u.emailVerified).toBe(false);
    expect(u.id).toMatch(UUID);
  });

  it("enforces unique (key, windowStart) on RateLimitHit and supports atomic increments", async () => {
    const windowStart = new Date("2026-11-08T10:00:00.000Z");
    await db.rateLimitHit.create({ data: { key: "ip:abc", windowStart, count: 1 } });
    await expect(db.rateLimitHit.create({ data: { key: "ip:abc", windowStart, count: 1 } })).rejects.toMatchObject({
      code: "P2002",
    });
    const hit = await db.rateLimitHit.upsert({
      where: { key_windowStart: { key: "ip:abc", windowStart } },
      create: { key: "ip:abc", windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    expect(hit.count).toBe(2);
  });

  it("enforces a unique SiteSetting key", async () => {
    await db.siteSetting.create({ data: { key: "notification.recipients.AROMA_CHEMICALS", value: [] } });
    await expect(
      db.siteSetting.create({ data: { key: "notification.recipients.AROMA_CHEMICALS", value: [] } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("resetDb", () => {
  it("empties every table", async () => {
    await db.product.create({ data: productData() });
    await makeEnquiry();
    await resetDb();
    expect(await db.product.count()).toBe(0);
    expect(await db.enquiry.count()).toBe(0);
  });
});
