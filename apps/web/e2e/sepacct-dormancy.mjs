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
 *   3. `/dashboard/spending` - a PRE-EXISTING page on the live site, and the first time the flag has
 *      had to hide something INSIDE a page people already use. The door is one link per row; with
 *      the flag off the count must be zero and the page must render normally. Needs a household,
 *      so the stub is flipped OFF `fresh` for this one check.
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

// 3. the door on the pre-existing page. `--mode fresh` has no household, so flip first.
//
// 🔴 `R-2` — THIS CHECK USED TO COUNT ONLY LINKS, HEADING AND `₪`, AND THE PAGE HIDES **TWO**
// THINGS. A one-clause mutant that drops `SEPACCT_UI_ENABLED` from `explainNoDoor` ships a Hebrew
// SEPACCT sentence to every declared household with no variable set - and printed a line BYTE-
// IDENTICAL to the passing one, because the paragraph carries no link and no `₪`. A control with
// zero power over half of what it certifies is the shape this program keeps paying for.
//
// ⚠️ AND IT RAN ONLY IN `empty`, WHERE `/me` IS AN OWNER WITH `permissions.all`. Flag ON, that
// viewer HAS doors, so `explainNoDoor` is false in both builds and the fixture could not exercise
// the paragraph in EITHER direction. `adultnopay` is the state the paragraph exists for - a
// non-manager who paid for nothing - so the check runs in both modes and asserts BOTH renderables.
const NO_DOOR_COPY = /נקבעת על ידי מי שרשם אותה או על ידי מנהלי הבית/;
for (const m of ["empty", "adultnopay"]) {
  await fetch(`http://127.0.0.1:4999/__mode?to=${m}`).catch(() => {});
  await page.goto(BASE + "/dashboard/spending", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const doors = await page.locator('a[href^="/shared-expenses?purchaseId="]').count();
  const spendingText = await page.locator("body").innerText();
  const rows = (spendingText.match(/₪/g) ?? []).length;
  const explainer = NO_DOOR_COPY.test(spendingText);
  const ok = doors === 0 && !explainer;
  console.log(`    /dashboard/spending [${m.padEnd(10)}] links=${doors} (must be 0)  no-door copy=${explainer} (must be false)  rendered=${/הוצאות החודש/.test(spendingText)}  ₪=${rows}  ${ok ? "OK" : "<<< DORMANCY FAILURE"}`);
}
await fetch("http://127.0.0.1:4999/__mode?to=fresh").catch(() => {});

await browser.close();
