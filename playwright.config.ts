import { defineConfig, devices } from "@playwright/test";

const widths = [375, 768, 1280, 1536] as const;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100" },
  projects: widths.map((width) => ({
    name: `w${width}`,
    use: { ...devices["Desktop Chrome"], viewport: { width, height: 900 } },
  })),
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
