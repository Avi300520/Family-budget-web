import { defineConfig, devices } from "@playwright/test";

// BATCH-GH accessibility VERIFICATION harness (no production change).
// Servers are started manually: memory-mode API :4100, apps/web production build :3000
// (built with NEXT_PUBLIC_API_URL=http://localhost:4100).
export default defineConfig({
  testDir: "./specs",
  globalSetup: "./lib/global-setup.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1, // one shared backend; /l actions mutate real server state
  reporter: [["list"], ["json", { outputFile: "evidence/playwright-results.json" }]],
  outputDir: "evidence/test-artifacts",
  use: { baseURL: "http://localhost:3000", trace: "off", screenshot: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
  ],
});
