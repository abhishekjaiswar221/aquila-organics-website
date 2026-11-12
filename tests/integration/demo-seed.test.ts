import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_JOB_SLUG, DEMO_NOTE_PREFIX, REFUSED_MESSAGE, resetDemo, seedDemo } from "@/features/demo/seed";
import { listPublishedJobs } from "@/features/careers/job-queries";
import { db, resetDb } from "./setup";

const rows: unknown = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/demo-products.json"), "utf8"));
const COUNT = Array.isArray(rows) ? rows.length : 0;

beforeEach(resetDb);

describe("seedDemo", () => {
  it("loads every sample product as published and verified, with its CAS normalised", async () => {
    const result = await seedDemo(db, rows);
    expect(result).toMatchObject({ ok: true, created: COUNT, published: COUNT, jobCreated: false });
    const all = await db.product.findMany();
    expect(all).toHaveLength(COUNT);
    for (const p of all) {
      expect(p, p.name).toMatchObject({ status: "PUBLISHED", verified: true });
      expect(p.publishedAt).not.toBeNull();
      expect(p.sourceNote?.startsWith(DEMO_NOTE_PREFIX)).toBe(true);
      expect(p.casNormalized).toBe((p.casNumber ?? "").replace(/-/g, ""));
    }
    expect((await db.category.findMany()).map((c) => c.name).sort()).toEqual(["Aroma Chemicals", "Flavour Ingredients"]);
  });

  it("is idempotent: a second run creates nothing and changes nothing", async () => {
    await seedDemo(db, rows);
    const before = await db.product.findMany({ orderBy: { slug: "asc" } });
    const again = await seedDemo(db, rows);
    expect(again).toMatchObject({ ok: true, created: 0, published: 0 });
    expect(await db.product.findMany({ orderBy: { slug: "asc" } })).toEqual(before);
  });

  it("refuses a database that already holds a real product, and writes nothing", async () => {
    await db.product.create({ data: { name: "TEST real product", slug: "test-real", sourceNote: "from the real catalogue" } });
    expect(await seedDemo(db, rows)).toEqual({ ok: false, reason: REFUSED_MESSAGE });
    expect(await db.product.count()).toBe(1);
  });

  it("refuses when a real product has no source note at all", async () => {
    await db.product.create({ data: { name: "TEST bare", slug: "test-bare" } });
    expect(await seedDemo(db, rows)).toMatchObject({ ok: false });
    expect(await db.product.count()).toBe(1);
  });

  it("proceeds on a database with real products only when forced, and leaves them untouched", async () => {
    const real = await db.product.create({ data: { name: "TEST real", slug: "test-real", sourceNote: "real" } });
    expect(await seedDemo(db, rows, { force: true })).toMatchObject({ ok: true, created: COUNT });
    expect(await db.product.findUniqueOrThrow({ where: { id: real.id } })).toMatchObject({ status: "DRAFT", verified: false });
  });

  it("refuses rows that are not marked as sample data before touching the database", async () => {
    await expect(seedDemo(db, [{ name: "Real", casNumber: "64-17-5", sourceNote: "real" }])).rejects.toThrow(/sample data/);
    expect(await db.product.count()).toBe(0);
  });

  it("adds one clearly named sample opening only on request, and it is public", async () => {
    await seedDemo(db, rows);
    expect(await db.jobOpening.count()).toBe(0);
    expect(await seedDemo(db, rows, { includeJob: true })).toMatchObject({ ok: true, jobCreated: true });
    expect(await seedDemo(db, rows, { includeJob: true })).toMatchObject({ ok: true, jobCreated: false });
    const job = await db.jobOpening.findUniqueOrThrow({ where: { slug: DEMO_JOB_SLUG } });
    expect(job.title.startsWith("[Sample]")).toBe(true);
    expect((await listPublishedJobs(new Date())).map((j) => j.slug)).toEqual([DEMO_JOB_SLUG]);
  });
});

describe("resetDemo", () => {
  it("removes only the sample products and the sample opening", async () => {
    await seedDemo(db, rows, { includeJob: true });
    const keep = await db.product.create({ data: { name: "TEST keep", slug: "test-keep", sourceNote: "real note" } });
    const keepJob = await db.jobOpening.create({
      data: { slug: "real-job", title: "Real", location: "L", employmentType: "FULL_TIME", summary: "s", description: "d" },
    });
    expect(await resetDemo(db)).toEqual({ products: COUNT, jobs: 1 });
    expect((await db.product.findMany()).map((p) => p.id)).toEqual([keep.id]);
    expect((await db.jobOpening.findMany()).map((j) => j.id)).toEqual([keepJob.id]);
  });

  it("is safe to run on an empty database and twice in a row", async () => {
    expect(await resetDemo(db)).toEqual({ products: 0, jobs: 0 });
    await seedDemo(db, rows);
    await resetDemo(db);
    expect(await resetDemo(db)).toEqual({ products: 0, jobs: 0 });
  });
});
