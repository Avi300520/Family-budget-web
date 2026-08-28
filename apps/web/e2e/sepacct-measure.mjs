#!/usr/bin/env node
/**
 * apps/web/e2e/sepacct-measure.mjs - the SEPACCT measurement run.
 *
 * Measures, in a REAL browser, what a code review cannot see:
 *   - document.scrollWidth == the viewport, at 320 / 375 / 1280. 320 is not optional here: this
 *     repository has a 320 regression on record (BATCH-GI D4) and the last run skipped it.
 *   - colour contrast from getComputedStyle on the RENDERED node, never from a CSS rule.
 *   - axe-core wcag2a + wcag2aa, with `ran: true/false` recorded per scan, because a sweep that
 *     silently threw once reported "0 violations" having never executed.
 *   - the split control by keyboard alone, reset included.
 *   - every state, including the two the deleted mock could not produce: a real dormant 404 from
 *     the server, and a 500 that is NOT a 404 and must render as an error rather than as absence.
 *
 * Usage (the caller owns the build, the server and the stub):
 *   node apps/web/e2e/sepacct-measure.mjs --base http://127.0.0.1:3410 --stub http://127.0.0.1:4999
 */

import { chromium } from "playwright-chromium";
import AxeBuilder from "@axe-core/playwright";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("base", "http://127.0.0.1:3410");
const STUB = arg("stub", "http://127.0.0.1:4999");

const PURCHASE = "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d";
const WIDTHS = [320, 375, 1280];

const ROUTES = [
  { name: "separate-accounts", path: "/settings/separate-accounts" },
  { name: "shared-expenses", path: `/shared-expenses?purchaseId=${PURCHASE}` },
  { name: "shared-expenses(no id)", path: "/shared-expenses" },
  { name: "my-income", path: "/my-income" },
  { name: "my-record", path: "/my-record" },
];

const MODES = ["populated", "empty", "window", "off", "forbidden", "error", "dormant"];

const setMode = async (mode) => {
  const r = await fetch(`${STUB}/__mode?to=${mode}`);
  if (!r.ok) throw new Error(`stub refused mode ${mode}`);
};

/** sRGB relative luminance, then the WCAG 1.4.3 ratio. Both from the rendered pixels. */
function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const parse = (css) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/**
 * The rendered colour of a node and of what is actually behind it. `getComputedStyle` reports a
 * transparent background as rgba(0,0,0,0), so the effective backdrop is the nearest ancestor that
 * paints - reading the rule instead of the pixels is how a 1.75:1 link shipped to production here.
 */
async function sample(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    let node = el;
    let bg = "rgba(0, 0, 0, 0)";
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      const a = (c.match(/[\d.]+/g) ?? [])[3];
      if (c !== "rgba(0, 0, 0, 0)" && a !== "0") { bg = c; break; }
      node = node.parentElement;
    }
    const r = el.getBoundingClientRect();
    return { color: cs.color, bg, fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: (el.textContent || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
  }, selector);
}

const rows = [];
const contrast = [];
const notes = [];

const browser = await chromium.launch();
console.log("=".repeat(100));
console.log(`  SEPACCT measurement - engine: [browser] chromium ${browser.version()}   base: ${BASE}   stub: ${STUB}`);
console.log("=".repeat(100));

for (const mode of MODES) {
  await setMode(mode);
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const route of ROUTES) {
      const page = await context.newPage();
      const row = { mode, width, route: route.name, ran: false };
      try {
        const resp = await page.goto(BASE + route.path, { waitUntil: "networkidle", timeout: 45_000 });
        row.status = resp?.status() ?? 0;
        await page.waitForTimeout(150);
        row.docSW = await page.evaluate(() => document.documentElement.scrollWidth);
        row.overflow = row.docSW > width;
        row.h1 = await page.locator("h1").count();
        row.main = await page.locator("main#main").count();
        row.alerts = await page.locator('[role="alert"]').count();
        row.body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 260);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        row.ran = true;
        row.violations = r.violations.length;
        row.serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").length;
        row.ids = r.violations.map((v) => `${v.id}(${v.impact})x${v.nodes.length}`).join(" ");
      } catch (err) {
        row.error = String(err?.message ?? err).split("\n")[0].slice(0, 120);
      } finally {
        await page.close();
      }
      rows.push(row);
    }
    await context.close();
  }
}

// ---- contrast, on the real rendered text, at one width (colour does not vary by viewport here) --
await setMode("populated");
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const targets = [
    ["/settings/separate-accounts", ".panel .muted", "settings muted body"],
    ["/settings/separate-accounts", "label", "the ON/OFF declaration label"],
    ["/settings/separate-accounts", ".button", "primary save button"],
    ["/my-record", ".panel .label", "component label"],
    ["/my-record", ".panel strong.mono", "component amount"],
    [`/shared-expenses?purchaseId=${PURCHASE}`, ".button.secondary", "dispute button"],
    [`/shared-expenses?purchaseId=${PURCHASE}`, "fieldset legend", "split control legend"],
  ];
  for (const [path, sel, label] of targets) {
    const page = await context.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45_000 });
      const s = await sample(page, sel);
      if (!s) { contrast.push({ label, note: "selector not present" }); continue; }
      const px = parseFloat(s.fontSize);
      const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
      const value = ratio(parse(s.color), parse(s.bg));
      contrast.push({ label, sel, color: s.color, bg: s.bg, fontSize: s.fontSize, large, ratio: value.toFixed(2), pass: value >= (large ? 3 : 4.5), text: s.text });
    } catch (err) {
      contrast.push({ label, note: String(err?.message ?? err).slice(0, 80) });
    } finally {
      await page.close();
    }
  }

  // ---- the OFF direction, end to end, against the real route -------------------------------
  {
    const page = await context.newPage();
    try {
      await page.goto(BASE + "/settings/separate-accounts", { waitUntil: "networkidle" });
      const box = page.locator('input[type="checkbox"]');
      const before = await box.isChecked();
      await box.uncheck();
      await page.getByRole("button", { name: /שמירה/ }).click();
      await page.waitForTimeout(600);
      const stored = await (await fetch(`${STUB}/api/v1/households/current/separate-accounts`)).json();
      notes.push(`OFF direction: checkbox ${before} -> ${await box.isChecked()}; server now separateAccounts=${stored.separateAccounts}; off-copy visible=${await page.locator("text=כיבוי עוצר").isVisible()}`);
      await box.check();
      await page.getByRole("button", { name: /שמירה/ }).click();
      await page.waitForTimeout(600);
      const back = await (await fetch(`${STUB}/api/v1/households/current/separate-accounts`)).json();
      notes.push(`ON direction: server now separateAccounts=${back.separateAccounts}`);
    } catch (err) {
      notes.push(`declaration walk FAILED: ${String(err?.message ?? err).slice(0, 140)}`);
    } finally {
      await page.close();
    }
  }

  // ---- the split control by keyboard alone, reset included ----------------------------------
  for (const width of [320, 1280]) {
    const kb = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await kb.newPage();
    try {
      await page.goto(BASE + `/shared-expenses?purchaseId=${PURCHASE}`, { waitUntil: "networkidle" });
      const seen = [];
      let reachedRange = false;
      let reachedReset = false;
      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press("Tab");
        const at = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return { tag: el.tagName.toLowerCase(), type: el.getAttribute("type"), name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30), outline: getComputedStyle(el).outlineWidth };
        });
        if (!at) continue;
        seen.push(`${at.tag}${at.type ? ":" + at.type : ""}`);
        if (at.tag === "input" && at.type === "range" && !reachedRange) {
          reachedRange = true;
          const start = await page.evaluate(() => document.activeElement.value);
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("ArrowRight");
          const after = await page.evaluate(() => document.activeElement.value);
          notes.push(`[${width}] range by keyboard: ${start} -> ${after} (bp), focus outline ${at.outline}`);
        }
        if (at.name.includes("חצי")) {
          reachedReset = true;
          await page.keyboard.press("Enter");
          await page.waitForTimeout(80);
          const v = await page.locator('input[type="range"]').inputValue();
          notes.push(`[${width}] reset "חצי חצי" reachable by keyboard and activates: range=${v}`);
          break;
        }
      }
      if (!reachedRange) notes.push(`[${width}] range NOT reachable by keyboard in 40 tabs`);
      if (!reachedReset) notes.push(`[${width}] reset NOT reachable by keyboard in 40 tabs (order: ${seen.join(" ")})`);
      // RTL isolation must survive: every number is its own left-to-right island.
      const iso = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll("bdi, [dir=ltr]").forEach(() => {});
        const money = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /₪/.test(e.textContent || ""));
        money.forEach((e) => {
          const isolated = e.closest("[dir=ltr]") || e.closest("bdi");
          if (!isolated) bad.push((e.textContent || "").trim().slice(0, 24));
        });
        return { moneyNodes: money.length, unisolated: bad };
      });
      notes.push(`[${width}] RTL isolation: ${iso.moneyNodes} money nodes, ${iso.unisolated.length} not inside dir=ltr/bdi ${iso.unisolated.join(" | ")}`);
    } catch (err) {
      notes.push(`[${width}] keyboard walk FAILED: ${String(err?.message ?? err).slice(0, 140)}`);
    } finally {
      await page.close();
      await kb.close();
    }
  }
  await context.close();
}

await browser.close();

// ---- report -------------------------------------------------------------------------------
const pad = (v, n) => String(v ?? "").padEnd(n).slice(0, n);
console.log("");
console.log(`${pad("mode", 11)}${pad("w", 6)}${pad("route", 24)}${pad("http", 6)}${pad("docSW", 7)}${pad("h1", 4)}${pad("main", 6)}${pad("axe ran", 9)}${pad("viol", 6)}notes`);
console.log("-".repeat(100));
for (const r of rows) {
  console.log(
    pad(r.mode, 11) + pad(r.width, 6) + pad(r.route, 24) + pad(r.status, 6) + pad(r.docSW, 7) +
    pad(r.h1, 4) + pad(r.main, 6) + pad(r.ran ? "yes" : "NO", 9) + pad(r.ran ? r.violations : "-", 6) +
    (r.error ? `ERROR ${r.error}` : (r.overflow ? `OVERFLOW ${r.docSW}>${r.width} ` : "") + (r.ids || ""))
  );
}
const scans = rows.filter((r) => r.ran);
console.log("");
console.log(`rows: ${rows.length}   axe scans that ACTUALLY RAN: ${scans.length}   scans that did not: ${rows.length - scans.length}`);
console.log(`violations across the scans that ran: ${scans.reduce((t, r) => t + r.violations, 0)} (serious/critical ${scans.reduce((t, r) => t + r.serious, 0)})`);
console.log(`horizontal overflow rows: ${rows.filter((r) => r.overflow).length}`);
// What each state actually RENDERS. The property under test: a 404 from the wire is ABSENCE and a
// 500 is an ERROR, and the two must never be shown as the same thing.
console.log("");
console.log("what each state renders (1280, first 92 chars of the main region):");
for (const mode of MODES) {
  console.log(`  --- ${mode} ---`);
  for (const r of rows.filter((x) => x.mode === mode && x.width === 1280)) {
    const main = (r.body || "").replace(/^.*?התנתקות/, "").trim().slice(0, 92);
    console.log(`    ${pad(r.route, 24)} alerts=${r.alerts} ${main || r.body}`);
  }
}
console.log("");
console.log("contrast, from getComputedStyle on the rendered node:");
for (const c of contrast) {
  console.log(c.note ? `  ${pad(c.label, 34)} ${c.note}` : `  ${pad(c.label, 34)} ${pad(c.color, 22)} on ${pad(c.bg, 22)} ${pad(c.fontSize, 8)} ${pad(c.ratio + ":1", 9)} ${c.pass ? "PASS" : "FAIL"}  ${c.text}`);
}
console.log("");
console.log("walks:");
for (const n of notes) console.log(`  ${n}`);
