import { defineConfig } from "vitest/config";
import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveTestDatabaseUrl } from "./tests/integration/env-guard";

// Real environment wins over .env, matching dotenv's default behaviour.
const envFile = path.resolve(__dirname, ".env");
const fileEnv = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
const source: Record<string, string | undefined> = { ...fileEnv, ...process.env };

// Throws (and so aborts the run) unless a separate test database is configured.
const testDatabaseUrl = resolveTestDatabaseUrl(source);

// Placeholders so server modules that parse env (src/lib/env.ts) load in tests.
const placeholders: Record<string, string> = {
  BETTER_AUTH_SECRET: "integration-test-secret-not-for-production-use",
  BETTER_AUTH_URL: "http://localhost:3000",
  STORAGE_DRIVER: "local",
  EMAIL_DRIVER: "dev",
  RATE_LIMIT_SALT: "integration-test-salt",
};
const missingPlaceholders = Object.fromEntries(
  Object.entries(placeholders).filter(([key]) => !source[key]),
);
// Workers inherit process.env; only .env values it lacks need passing on.
const fileOnlyEnv = Object.fromEntries(
  Object.entries(fileEnv).filter(([key]) => process.env[key] === undefined),
);

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // Test files share one database: run them one at a time, in one worker.
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      ...fileOnlyEnv,
      ...missingPlaceholders,
      // The app's DATABASE_URL is replaced by the test database for every test.
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_TEST: testDatabaseUrl,
    },
  },
});
