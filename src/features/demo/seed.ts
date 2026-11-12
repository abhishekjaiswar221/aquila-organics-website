import type { PrismaClient } from "@/generated/prisma/client";
import { importProducts } from "@/features/products/import";

/*
 * Demo kit: loads and removes a clearly labelled SAMPLE catalogue so the site can be shown to a prospective
 * client. Sample products are published and verified directly, which deliberately skips the normal human
 * verification step: that is only acceptable because they are well-known chemicals marked as sample data and
 * this runs only against a demo database (it refuses a database that already holds real products).
 */

/** Every sample product's source note starts with this; it is how reset finds exactly the sample rows. */
export const DEMO_NOTE_PREFIX = "SAMPLE DATA";
export const DEMO_DESCRIPTION_PREFIX = "Sample listing for demonstration.";
export const DEMO_JOB_SLUG = "sample-quality-analyst";

export const REFUSED_MESSAGE =
  "This database already contains products that are not sample data. Refusing to add demo data to it. " +
  "Pass --force only if you are certain this is a demo database.";

const sampleNote = { startsWith: DEMO_NOTE_PREFIX } as const;

export type SeedOptions = { force?: boolean; includeJob?: boolean };
export type SeedResult =
  | { ok: true; created: number; updated: number; skipped: number; published: number; jobCreated: boolean }
  | { ok: false; reason: string };

/** Rows from data/demo-products.json, accepted only if every row is marked as sample data. */
export function validateSampleRows(rows: unknown): unknown[] {
  if (!Array.isArray(rows)) throw new Error("The demo data must be an array of products.");
  for (const [i, row] of rows.entries()) {
    const note = typeof row === "object" && row !== null && "sourceNote" in row ? row.sourceNote : undefined;
    const description = typeof row === "object" && row !== null && "description" in row ? row.description : undefined;
    if (typeof note !== "string" || !note.startsWith(DEMO_NOTE_PREFIX)) {
      throw new Error(`Demo row ${i + 1} is not marked as sample data (sourceNote must start with "${DEMO_NOTE_PREFIX}").`);
    }
    if (typeof description !== "string" || !description.startsWith(DEMO_DESCRIPTION_PREFIX)) {
      throw new Error(`Demo row ${i + 1} does not begin its description with "${DEMO_DESCRIPTION_PREFIX}".`);
    }
  }
  return rows;
}

export async function seedDemo(db: PrismaClient, rawRows: unknown, options: SeedOptions = {}): Promise<SeedResult> {
  const rows = validateSampleRows(rawRows);

  const real = await db.product.count({ where: { OR: [{ sourceNote: null }, { NOT: { sourceNote: sampleNote } }] } });
  if (real > 0 && !options.force) return { ok: false, reason: REFUSED_MESSAGE };

  const imported = await importProducts(rows, db);
  // Sample rows go live in one step: the CHECK constraint needs verified together with PUBLISHED.
  const { count: published } = await db.product.updateMany({
    where: { sourceNote: sampleNote, verified: false },
    data: { verified: true, status: "PUBLISHED", publishedAt: new Date() },
  });

  let jobCreated = false;
  if (options.includeJob) {
    const existing = await db.jobOpening.findUnique({ where: { slug: DEMO_JOB_SLUG }, select: { id: true } });
    if (!existing) {
      await db.jobOpening.create({
        data: {
          slug: DEMO_JOB_SLUG,
          title: "[Sample] Quality Analyst",
          location: "Sample location",
          employmentType: "FULL_TIME",
          summary: "Sample opening for demonstration only. Not a real vacancy.",
          description:
            "This is a sample opening created for a demonstration. It is not a real vacancy.\n\nIt exists so the application form and the HR inbox can be shown.",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      jobCreated = true;
    }
  }

  return {
    ok: true,
    created: imported.created,
    updated: imported.updated,
    skipped: imported.skipped.length,
    published,
    jobCreated,
  };
}

export type ResetResult = { products: number; jobs: number };

/** Removes only the sample products and the sample opening. Everything else is left alone. */
export async function resetDemo(db: PrismaClient): Promise<ResetResult> {
  const { count: products } = await db.product.deleteMany({ where: { sourceNote: sampleNote } });
  const { count: jobs } = await db.jobOpening.deleteMany({
    where: { slug: DEMO_JOB_SLUG, title: { startsWith: "[Sample]" } },
  });
  return { products, jobs };
}
