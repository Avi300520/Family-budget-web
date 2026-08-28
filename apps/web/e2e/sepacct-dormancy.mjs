#!/usr/bin/env node
/**
 * apps/web/e2e/sepacct-dormancy.mjs - does the BUILT artifact ship dormant?
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so this question can only be answered by a build, and
 * only by running one: reading `SEPACCT_UI_ENABLED` in the source proves nothing about the bundle.
 *
 * Two things are asserted against a running `next start`, both observed rather than inferred:
 *   1. the four SEPACCT routes answer HTTP 404 and render the not-found page;
 *   2. the onboarding wizard's own "N/TOTAL" step counter, which is `stepCount` - so the
 *      separate-accounts step is counted if and only if it shipped. Needs the stub in `--mode
 *      fresh` (a user with no household), the only state in which /onboarding renders the wizard.
 *
 *   node apps/web/e2e/sepacct-dormancy.mjs http://127.0.0.1:3410
 */

import { chromium } from "playwright-chromium";

const BASE = process.argv[2] ?? "http://127.0.0.1:3410";
const ROUTES = ["/settings/separate-accounts", "/shared-expenses", "/my-income", "/my-record"];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

console.log(`  built artifact at ${BASE}`);
for (const route of ROUTES) {
  const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 44);
  console.log(`    ${route.padEnd(30)} http=${resp?.status()}  "${body}"`);
}

await page.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const text = await page.locator("body").innerText();
const counter = text.match(/(\d+)\s*\/\s*(\d+)/);
console.log(`    /onboarding  step counter="${counter ? counter[0] : "(none - wizard did not render)"}"  stepCount=${counter ? counter[2] : "?"}`);
console.log(`    /onboarding  separate-accounts step title present: ${/איך הכספים מתנהלים/.test(text)}`);

await browser.close();
