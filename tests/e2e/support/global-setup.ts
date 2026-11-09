import { execSync } from "node:child_process";
import { E2E_STORAGE_ROOT, REPO_ROOT, assertTestDatabase, e2eDatabaseUrl } from "./e2e-env";

// Playwright starts the webServer (playwright.config.ts) before this runs. The
// app reads the database only at request time, so seeding here, before any
// test, is early enough.
export default function globalSetup(): void {
  const url = e2eDatabaseUrl();
  assertTestDatabase(url);
  const env = { ...process.env, DATABASE_URL: url, STORAGE_LOCAL_ROOT: E2E_STORAGE_ROOT };
  run("npx prisma migrate deploy", env, "prisma migrate deploy");
  run("npx tsx tests/e2e/support/seed.ts", env, "e2e seed");
}

function run(command: string, env: NodeJS.ProcessEnv, label: string): void {
  try {
    execSync(command, { cwd: REPO_ROOT, env, stdio: "pipe" });
  } catch (error) {
    const out =
      error instanceof Error && "stdout" in error
        ? `${String(error.stdout)}\n${"stderr" in error ? String(error.stderr) : ""}`
        : String(error);
    throw new Error(`${label} failed on the e2e test database.\n${out}`);
  }
}
