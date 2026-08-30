#!/usr/bin/env node
/**
 * apps/web/e2e/sepacct-door.mjs - can a declared household reach a split, and ONLY where it may?
 *
 * `R-1` stopped a run because the answer was no: the only page producing a `purchaseId` listed
 * purchases that already HAD a split, so the capability bootstrapped only from a state it could not
 * reach. The door is one gated link per row on `/dashboard/spending`, a page that already exists.
 *
 * Two things are asserted against a running `next start` built WITH NEXT_PUBLIC_SEPACCT_UI=1:
 *   1. the link appears on exactly the rows the server would accept a split for, and on no others -
 *      "a door that opens onto a refusal is worse than no door";
 *   2. following it reaches the split control and SAVES, which is the whole bootstrap.
 *
 *   node apps/web/e2e/sepacct-door.mjs http://127.0.0.1:3410
 *
 * Needs apps/web/e2e/sepacct-stub.mjs on :4999; the walk uses --mode empty so the split GET answers
 * `allocation: null`, and re-runs the door check in --mode adult for the non-manager rule.
 */

import { chromium } from "playwright-chromium";

const BASE = process.argv[2] ?? "http://127.0.0.1:3410";
const STUB = "http://127.0.0.1:4999";

const ROWS = {
  "רמי לוי": { id: "3c1a9e77-2b48-4d61-9f05-7a2e6c8b41d9", why: "payer = viewer, after declaration", owner: true, adult: true },
  "פארם": { id: "8e4d5b12-6c37-4a90-b2e8-1f9c0d3a5b76", why: "payer = partner, after declaration", owner: true, adult: false },
  "סופר השכונה": { id: "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d", why: "already split, payer = partner", owner: true, adult: false },
  "בלי משלם": { id: "f0d3b8a5-1c47-4a92-8e6d-2b5c7a91d0f3", why: "NO payer -> 409 split.no_payer", owner: false, adult: false },
  "לפני ההסדר": { id: "5b7e2a94-0d13-4c68-8a5f-3e6b9d1c7048", why: "before the declaration -> 409 split.before_arrangement", owner: false, adult: false },
};

const browser = await chromium.launch();
let failures = 0;

async function setMode(to) {
  await fetch(`${STUB}/__mode?to=${to}`);
}

async function doorCheck(label, expectKey) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
  await page.goto(`${BASE}/dashboard/spending`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  console.log(`\n  --- door as ${label} ---`);
  for (const [merchant, row] of Object.entries(ROWS)) {
    const expected = row[expectKey];
    const link = page.locator(`a[href="/shared-expenses?purchaseId=${row.id}"]`);
    const actual = (await link.count()) > 0;
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`    ${ok ? "OK  " : "FAIL"}  ${merchant.padEnd(14)} link=${String(actual).padEnd(5)} expected=${String(expected).padEnd(5)}  (${row.why})`);
  }
  await page.close();
}

await setMode("empty");
await doorCheck("owner (manager)", "owner");
await setMode("adult");
await doorCheck("adult_member (not a manager)", "adult");

// ── The walk. Click the door, set a ratio, save, and read the money back. ────────────────────
await setMode("empty");
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
const clicks = [];
console.log("\n  --- the walk ---");
await page.goto(`${BASE}/dashboard/spending`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
clicks.push("open /dashboard/spending");

const door = page.locator(`a[href="/shared-expenses?purchaseId=${ROWS["רמי לוי"].id}"]`).first();
await door.click();
clicks.push('click "חלוקה" on the רמי לוי row');
await page.waitForTimeout(1800);

const hasControl = (await page.locator('input[type="range"]').count()) > 0;
clicks.push(`split control present: ${hasControl}`);
if (!hasControl) failures++;

const saveBtn = page.locator('button:has-text("שמירת חלוקה")');
const hasSave = (await saveBtn.count()) > 0;
clicks.push(`save button present: ${hasSave}`);
if (!hasSave) failures++;

if (hasControl && hasSave) {
  await saveBtn.first().click();
  clicks.push('press "שמירת חלוקה"');
  await page.waitForTimeout(1800);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const saved = /חלקך לפי החלוקה השמורה/.test(body);
  const money = body.match(/₪[\d,]+\.\d\d/g) ?? [];
  clicks.push(`saved allocation rendered: ${saved}  amounts on page: ${money.slice(0, 4).join("  ")}`);
  if (!saved) failures++;
}
clicks.forEach((c, i) => console.log(`    ${i + 1}. ${c}`));

await page.close();
await browser.close();
console.log(`\n  ${failures === 0 ? "DOOR OK - link exactly where a split is accepted, and the walk completes" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
