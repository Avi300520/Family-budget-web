import { defineConfig } from "@playwright/test";

// Smoke-only config. Servers (web :3000, memory API :4000) are started manually
// before running. Not wired into CI yet — see e2e/smoke.spec.ts.
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
});
