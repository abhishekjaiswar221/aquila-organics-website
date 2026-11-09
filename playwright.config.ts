import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, e2eServerEnv } from "./tests/e2e/support/e2e-env";

const widths = [375, 768, 1280, 1536] as const;

// Throws at config load unless DATABASE_URL_TEST names a separate *_test
// database, so the app server is never started against development data.
const serverEnv = e2eServerEnv();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/support/global-setup.ts",
  use: { baseURL: E2E_BASE_URL },
  projects: widths.map((width) => ({
    name: `w${width}`,
    use: { ...devices["Desktop Chrome"], viewport: { width, height: 900 } },
  })),
  webServer: {
    command: `npm run build && npm run start -- -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    // Always our own server: a reused one could be pointed at the dev database.
    reuseExistingServer: false,
    env: serverEnv,
    timeout: 300_000,
  },
});
