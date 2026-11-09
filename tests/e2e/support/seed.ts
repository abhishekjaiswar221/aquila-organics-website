// Resets the e2e (TEST) database and seeds the fake fixtures from fixtures.ts.
// Run by global-setup.ts through tsx with DATABASE_URL and STORAGE_LOCAL_ROOT set.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../../src/generated/prisma/client";
import { E2E_STORAGE_ROOT, assertTestDatabase } from "./e2e-env";
import { ADMIN_USERS, ARCHIVED, BULK, CATEGORY, DRAFT, ETHANOL, MINIMAL, SOURCE_NOTE, WATER } from "./fixtures";

const digits = (cas: string) => cas.replace(/-/g, "");

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  assertTestDatabase(url);
  const root = process.env.STORAGE_LOCAL_ROOT;
  // The root is emptied below, so it must be the dedicated e2e directory.
  if (!root || path.resolve(root) !== E2E_STORAGE_ROOT) {
    throw new Error(`STORAGE_LOCAL_ROOT must be ${E2E_STORAGE_ROOT} for the e2e seed.`);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const rows = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (rows.length > 0) {
      const tables = rows.map((r) => `"public"."${r.tablename.replace(/"/g, '""')}"`).join(", ");
      await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
    }

    await db.category.createMany({ data: [CATEGORY.solvents, CATEGORY.fixtures] });

    const published = (n: number) => ({
      status: "PUBLISHED" as const,
      verified: true,
      // Distinct, stable publish dates so "newest" ordering is deterministic.
      publishedAt: new Date(Date.UTC(2026, 0, 1, 0, n)),
      sourceNote: SOURCE_NOTE,
    });

    await db.product.create({
      data: {
        id: ETHANOL.id,
        slug: ETHANOL.slug,
        name: ETHANOL.name,
        code: ETHANOL.code,
        casNumber: ETHANOL.cas,
        casNormalized: digits(ETHANOL.cas),
        description: ETHANOL.description,
        categoryId: CATEGORY.solvents.id,
        ...published(100),
        specifications: {
          create: ETHANOL.specifications.map((s, i) => ({ label: s.label, value: s.value, sortOrder: i })),
        },
        applications: { create: ETHANOL.applications.map((name) => ({ name })) },
        documents: {
          create: {
            id: ETHANOL.document.id,
            kind: "DATASHEET",
            title: ETHANOL.document.title,
            storageKey: ETHANOL.document.storageKey,
            mimeType: ETHANOL.document.mimeType,
          },
        },
      },
    });
    await db.product.create({
      data: {
        id: WATER.id,
        slug: WATER.slug,
        name: WATER.name,
        code: WATER.code,
        casNumber: WATER.cas,
        casNormalized: digits(WATER.cas),
        categoryId: CATEGORY.solvents.id,
        ...published(101),
      },
    });
    await db.product.create({ data: { id: MINIMAL.id, slug: MINIMAL.slug, name: MINIMAL.name, ...published(102) } });
    await db.product.create({
      data: {
        id: DRAFT.id,
        slug: DRAFT.slug,
        name: DRAFT.name,
        code: DRAFT.code,
        casNumber: DRAFT.cas,
        casNormalized: digits(DRAFT.cas),
        categoryId: CATEGORY.solvents.id,
        status: "DRAFT",
        documents: {
          create: {
            id: DRAFT.document.id,
            kind: "SDS",
            title: DRAFT.document.title,
            storageKey: DRAFT.document.storageKey,
            mimeType: DRAFT.document.mimeType,
          },
        },
      },
    });
    await db.product.create({
      data: {
        id: ARCHIVED.id,
        slug: ARCHIVED.slug,
        name: ARCHIVED.name,
        code: ARCHIVED.code,
        casNumber: ARCHIVED.cas,
        casNormalized: digits(ARCHIVED.cas),
        categoryId: CATEGORY.solvents.id,
        status: "ARCHIVED",
        verified: true,
      },
    });
    await db.product.createMany({
      data: BULK.map((p, i) => ({ ...p, categoryId: CATEGORY.fixtures.id, ...published(i) })),
    });

    // Admin accounts, stored the way Better Auth's credential sign-up stores
    // them (its own password hasher; account id = user id).
    for (const u of Object.values(ADMIN_USERS)) {
      await db.user.create({
        data: {
          id: u.id,
          email: u.email,
          name: u.email.split("@")[0],
          emailVerified: true,
          role: u.role,
          accounts: { create: { accountId: u.id, providerId: "credential", password: await hashPassword(u.password) } },
        },
      });
    }

    // Document files live in their own storage root; both files exist, so a
    // 404 for the draft document proves the status check, not a missing file.
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, ETHANOL.document.storageKey), ETHANOL.document.body);
    await writeFile(path.join(root, DRAFT.document.storageKey), DRAFT.document.body);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
