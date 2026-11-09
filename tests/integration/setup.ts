import { afterAll } from "vitest";
import { db } from "@/lib/db";
import { resolveTestDatabaseUrl } from "./env-guard";

// vitest.integration.config.ts points DATABASE_URL at DATABASE_URL_TEST; check
// again here so a misconfigured run can never reach the development database.
const testUrl = resolveTestDatabaseUrl({ DATABASE_URL_TEST: process.env.DATABASE_URL_TEST });
if (process.env.DATABASE_URL !== testUrl) {
  throw new Error("Refusing to run integration tests: DATABASE_URL is not the test database.");
}

export { db };

/** Empties every application table (keeps the migration history). */
export async function resetDb(): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename.replace(/"/g, '""')}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

afterAll(async () => {
  await db.$disconnect();
});
