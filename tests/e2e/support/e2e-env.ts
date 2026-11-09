import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveTestDatabaseUrl } from "../../integration/env-guard";

// Shared by playwright.config.ts (the app server's environment) and the e2e
// global setup (migrate + seed). Both refuse to run unless the database is a
// dedicated *_test database, so the suite can never touch development data.

export const REPO_ROOT = path.resolve(__dirname, "../../..");
/**
 * Port for the e2e build (`next start`). Defaults to 3100; set E2E_PORT in the
 * environment when another server already holds it (do not edit this default).
 */
export const E2E_PORT = parsePort(process.env.E2E_PORT);

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 3100;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`E2E_PORT must be an integer from 1024 to 65535, got "${value}".`);
  }
  return port;
}
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/** LocalStorage root for e2e document fixtures (under the git-ignored /storage). */
export const E2E_STORAGE_ROOT = path.join(REPO_ROOT, "storage", "e2e", "uploads");

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

function sourceEnv(): Record<string, string | undefined> {
  const envFile = path.join(REPO_ROOT, ".env");
  const fileEnv = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
  // Real environment wins over .env, as with dotenv.
  return { ...fileEnv, ...process.env };
}

/** DATABASE_URL_TEST, guaranteed distinct from DATABASE_URL and named *_test. */
export function e2eDatabaseUrl(): string {
  const url = resolveTestDatabaseUrl(sourceEnv());
  assertTestDatabase(url);
  return url;
}

export function assertTestDatabase(url: string | undefined): void {
  const name = url ? databaseName(url) : "";
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run e2e tests: the target database "${name || "(none)"}" does not end in "_test".`,
    );
  }
}

/**
 * Environment for `next build` + `next start`. Set through Playwright's
 * webServer.env, so it works the same on Windows and POSIX shells.
 */
export function e2eServerEnv(): Record<string, string> {
  const source = sourceEnv();
  const placeholders: Record<string, string> = {
    BETTER_AUTH_SECRET: "e2e-test-secret-not-for-production-use-0000",
    BETTER_AUTH_URL: E2E_BASE_URL,
    STORAGE_DRIVER: "local",
    EMAIL_DRIVER: "dev",
    RATE_LIMIT_SALT: "e2e-test-salt",
  };
  const fromSource = Object.fromEntries(
    Object.keys(placeholders)
      .filter((k) => source[k])
      .map((k) => [k, source[k] as string]),
  );
  return {
    ...placeholders,
    ...fromSource,
    DATABASE_URL: e2eDatabaseUrl(),
    STORAGE_LOCAL_ROOT: E2E_STORAGE_ROOT,
    NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
  };
}
