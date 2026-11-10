import { execSync } from "node:child_process";
import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { acquireTestDbLock, releaseTestDbLock } from "../support/test-db-lock";
import { resolveTestDatabaseUrl } from "./env-guard";

// Brings the test database up to the latest migration before any test runs.
export default async function setup(): Promise<() => Promise<void>> {
  const root = path.resolve(__dirname, "../..");
  const envFile = path.join(root, ".env");
  const fileEnv = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
  const url = resolveTestDatabaseUrl({ ...fileEnv, ...process.env });
  // Fails fast if an e2e (or another integration) run is using the shared database.
  await acquireTestDbLock(url, "test:int");
  try {
    execSync("npx prisma migrate deploy", {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (error) {
    const output = error instanceof Error && "stdout" in error ? String(error.stdout) : "";
    await releaseTestDbLock();
    throw new Error(`prisma migrate deploy failed on the test database.\n${output}`);
  }
  return releaseTestDbLock;
}
