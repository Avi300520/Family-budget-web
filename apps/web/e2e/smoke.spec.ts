import { test, expect } from "@playwright/test";
import path from "node:path";

// Real-browser smoke of the redesigned Settings IA + shell, across roles + viewports.
// Servers must be running: web :3000 (NEXT_PUBLIC_API_URL=http://localhost:4000) and the
// memory-mode API :4000, seeded via scratchpad/seed.mjs + seed2.mjs.

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

const ROLES = [
  { name: "owner", fixture: "owner-with-data" },
  { name: "adult", fixture: "adult-with-data" },
  { name: "limited", fixture: "limited-with-data" },
  { name: "owner-empty", fixture: "owner-empty" },
];

const ROUTES: Array<[string, string]> = [
  ["dashboard", "/dashboard"],
  ["insights", "/insights"],
  ["shopping", "/shopping-list"],
  ["wishlists", "/family/wishlists"],
  ["onboarding", "/onboarding"],
  ["export", "/export"],
  ["settings", "/settings"],
  ["household", "/settings/household"],
  ["members", "/settings/members"],
  ["categories", "/settings/category-budgets"],
  ["notifications", "/settings/notifications"],
  ["billing", "/settings/billing"],
  ["receipts", "/receipts"],
];

// Run from apps/web (cwd). ESM scope has no __dirname.
const SHOT_DIR = path.resolve("test-results", "screenshots");
const FIX_DIR = path.resolve("e2e", "fixtures");

for (const vp of VIEWPORTS) {
  for (const role of ROLES) {
    test(`${role.name} @ ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(FIX_DIR, `${role.fixture}.json`),
      });
      const page = await context.newPage();
      const serverErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on("response", (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`); });
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

      const overflows: string[] = [];
      const redirects: string[] = [];

      for (const [label, route] of ROUTES) {
        await page.goto(route, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(500);
        if (!page.url().includes(route)) redirects.push(`${label} -> ${page.url()}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (overflow) overflows.push(label);
        await page.screenshot({ path: path.join(SHOT_DIR, `${role.name}-${label}-${vp.name}.png`), fullPage: true });
      }

      console.log(`\n[${role.name} @ ${vp.name}] redirects: ${redirects.join(", ") || "none"}`);
      if (consoleErrors.length) console.log(`[${role.name} @ ${vp.name}] console errors:`, consoleErrors.slice(0, 6));

      expect(overflows, `horizontal overflow on: ${overflows.join(", ")}`).toEqual([]);
      expect(serverErrors, `5xx responses`).toEqual([]);
      await context.close();
    });
  }
}
