// Summarise evidence/results.ndjson into a compact digest for the report.
import fs from "node:fs";
const raw = fs.readFileSync(new URL("./evidence/results.ndjson", import.meta.url), "utf8")
  .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
// The /l tests were re-run with fresh share tokens after the long first pass let them expire.
// Keep the LAST record for each (kind, browser, route, mode, viewport) key.
const keyed = new Map();
for (const r of raw) keyed.set([r.kind, r.browser, r.route, r.mode, r.viewport].join("|"), r);
const rows = [...keyed.values()];
const by = (k) => rows.filter((r) => r.kind === k);
const P = (...a) => console.log(...a);

P("=== TOTAL RECORDS", rows.length, "===\n");

P("--- AXE (route x mode x browser) ---");
for (const r of by("axe")) {
  const v = r.violationIds.map((x) => `${x.id}[${x.impact}] n=${x.nodes} ${JSON.stringify(x.targets)}`).join("; ");
  P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} ${r.mode.padEnd(16)} viol=${r.violations} inc=${r.incomplete} pass=${r.passes} ${v}`);
}
P("\n--- AXE incomplete detail (never a pass) ---");
const incs = {};
for (const r of by("axe")) for (const i of r.incompleteIds) incs[i.id] = (incs[i.id] || 0) + 1;
P(JSON.stringify(incs));

P("\n--- STRUCTURE ---");
for (const r of by("structure")) {
  P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} h1=${r.h1} main=${r.mains} mainId=${r.mainHasId} skipFirst=${r.skipLinkIsFirstFocusable} headOrder=${JSON.stringify(r.headingOrderIssues)} unnamed=${r.unnamed.length} nameIssues=${JSON.stringify(r.nameIssues)} imgsNoAlt=${r.imgsMissingAlt} axListitems=${r.axListItems} axLists=${r.axLists} lang=${r.lang} dir=${r.dir}`);
  const bad = r.lists.filter((l) => l.flexLi > 0 && l.explicitListitem < l.flexLi);
  if (bad.length) P(`         LISTS-AT-RISK: ${bad.length} list(s), ${bad.reduce((a, b) => a + b.flexLi, 0)} flex <li> with no explicit role="listitem" | ${JSON.stringify(bad)}`);
  const unl = r.fields.filter((f) => !f.labelled);
  if (unl.length) P(`         UNLABELLED FIELDS: ${JSON.stringify(unl)}`);
}

P("\n--- KEYBOARD tab walk ---");
for (const r of by("keyboard-tabwalk")) {
  P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} stops=${r.stopCount} first=${r.firstStop?.tag}.${(r.firstStop?.cls||"").slice(0,20)} trapped=${r.trapped} lost=${r.lost} noIndicator=${r.noIndicator.length} ${r.noIndicator.length ? JSON.stringify(r.noIndicator.slice(0,4)) : ""}`);
}
P("\n--- KEYBOARD menu ---");
for (const r of by("keyboard-menu")) P(JSON.stringify(r));
P("\n--- KEYBOARD /l actions ---");
for (const r of by("keyboard-l-actions")) P(r.browser, JSON.stringify(r.results), "lockedH1=", r.lockedH1, "lockedMain=", r.lockedMain, "missPressed=", r.missingAriaPressedAfterToggle);

P("\n--- CONTRAST (measured, getComputedStyle) ---");
for (const r of by("contrast")) {
  P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} ${r.mode.padEnd(16)} sampled=${r.sampled} FAIL=${r.failures.length} tightest=${r.tightestPass?.ratio}:1 (need ${r.tightestPass?.required}) "${r.tightestPass?.text}" | 1.4.11-fail=${r.boundaries1411.length}/${r.boundariesSampled}`);
  for (const f of r.failures) P(`         FAIL ${f.ratio}:1 need ${f.required} "${f.text}" fg=${f.fg} bg=${f.bg} op=${f.opacity} @ ${f.path}`);
  if (r.opacityDimmedText?.length) P(`         OPACITY-DIMMED TEXT: ${JSON.stringify(r.opacityDimmedText.slice(0, 5))}`);
}

P("\n--- 1.4.11 boundary failures (WCAG 2.1, informational for a 2.0 statement) ---");
const seen = new Set();
for (const r of by("contrast")) for (const b of r.boundaries1411 || []) {
  const k = `${r.route}|${r.mode}|${b.name}|${b.ratio}`;
  if (seen.has(k)) continue; seen.add(k);
  P(`${r.route.padEnd(18)} ${r.mode.padEnd(16)} ${b.tag} "${b.name}" border=${b.border} on ${b.against} = ${b.ratio}:1`);
}

P("\n--- REFLOW / ZOOM ---");
for (const r of by("reflow")) {
  P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} ${r.viewport.padEnd(10)} docSW=${r.docScrollWidth} clientW=${r.clientWidth} overflow=${r.overflow} clipped=${r.clipped.length} ${r.clipped.length ? JSON.stringify(r.clipped.slice(0,3)) : ""}`);
}
P("\n--- FONT SCALE REFLOW ---");
for (const r of by("font-scale-reflow")) P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} zoom=${r.zoom} docSW=${r.docScrollWidth} clientW=${r.clientWidth} overflow=${r.overflow}`);

P("\n--- LAUNCHER vs STICKY CTA ---");
for (const r of by("launcher-overlap")) {
  P(`${r.browser.padEnd(8)} ${r.route.padEnd(18)} ${r.viewport} launcher=${JSON.stringify(r.launcher)} overlaps=${JSON.stringify(r.overlaps)}`);
  for (const s of r.stickies) P(`         sticky "${s.text}" box=${JSON.stringify(s.box)} ctas=${JSON.stringify(s.ctas)}`);
}

P("\n--- MOTION ---");
for (const r of by("motion")) P(JSON.stringify(r));
P("\n--- COLOUR NOT ALONE ---");
for (const r of by("colour-not-alone")) P(r.browser, "outOfStockText=", r.hasOutOfStockText, "partialText=", r.hasPartialText, "|", r.mainText?.slice(0, 300));
P("\n--- /l ACCESSIBLE NAMES ---");
for (const r of by("l-names")) { P(`${r.browser} ${r.route}`); for (const b of r.buttons) P(`   acc="${b.accName}"`); }
P("\n--- FORM ERRORS ---");
for (const r of by("form-errors")) P(JSON.stringify(r));
P("\n--- CONSUME SUCCESS ---");
for (const r of by("consume-success")) P(JSON.stringify(r));
