#!/usr/bin/env node
/**
 * apps/web/e2e/sepacct-walk.mjs — `CC_UX_BUILD` item 8. **WALK IT AS A PERSON.**
 *
 * Not a probe. A browser, two roles, and a click log. Every action is recorded with the text of the
 * thing that was clicked, and every screen with the heading a person would read, so the output is a
 * transcript rather than a pass/fail.
 *
 *   node apps/web/e2e/sepacct-walk.mjs --base http://127.0.0.1:3410 --stub http://127.0.0.1:4999
 *
 * The caller owns the build, the server and the stub — and the build must carry
 * `NEXT_PUBLIC_SEPACCT_UI=1`, because the variable is inlined at build time and without it all four
 * screens render the 404 page.
 *
 * ⚠️ TWO LEGS OF THE WALK ARE NOT IN A BROWSER, AND THE SCRIPT SAYS SO RATHER THAN FAKING THEM.
 * "record a shared expense and watch it split itself" and "read the WhatsApp confirmation" are
 * backend behaviours; a stub that split its own fixtures would be this harness marking its own
 * homework. They are evidenced by `sepacct-autosplit.gate.test.ts` and
 * `sepacct-autosplit-line.gate.test.ts`, which drive the real store and the real inbound endpoint.
 */
import { chromium } from "playwright-chromium";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("base", "http://127.0.0.1:3410");
const STUB = arg("stub", "http://127.0.0.1:4999");

const PURCHASE = "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d";

let step = 0;
const log = (...a) => console.log(...a);
const act = (what) => log(`   ${String(++step).padStart(2, " ")}. ${what}`);
const screen = (name) => log(`\n── ${name} ${"─".repeat(Math.max(0, 66 - name.length))}`);

const setMode = async (m) => { await fetch(`${STUB}/__mode?to=${m}`); };

/** Everything a person could read as an instruction, in order, trimmed. */
async function visible(page) {
  return (await page.locator("main, body").first().innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
}
async function heading(page) {
  const h = page.locator("h1").first();
  return (await h.count()) ? (await h.innerText()).trim() : "(no h1)";
}
/** Click by visible text and record it. Fails loudly: a walk that silently skips a click is a walk
 *  that proves the screens it could not reach are fine.
 *
 *  🔴 **IT CLICKS A CONTROL, AND THE FIRST CUT CLICKED ANY TEXT CONTAINING THE WORD.** `getByText`
 *  with `exact: false` is a SUBSTRING match over every node, and `בהמשך` — an ordinary Hebrew word
 *  meaning "later on" — contains `המשך`, the label of the wizard's own continue button. §A68's new
 *  sentence uses that word, so the paragraph matched before the button, every `click(page, "המשך")`
 *  pressed a paragraph, and the wizard sat on step 3/8 for eleven consecutive clicks.
 *
 *  **And the walk called that success for two of its own checks**, because the assertions that
 *  follow read whatever screen it was on: `asks for MY OWN income? yes` was answered by §A68's
 *  sentence, on the separate-accounts step, about an income field two steps away. That is §A70's
 *  exact shape — a green cell whose subject was never reached — found the same day §A70 was
 *  written, and produced by the line added to satisfy §A68.
 *
 *  So the walk now clicks what a person clicks: a button or a link. Prose containing the word is
 *  no longer a candidate, in this or any future leg. */
async function click(page, text, note) {
  const control = page.getByRole("button", { name: new RegExp(text) })
    .or(page.getByRole("link", { name: new RegExp(text) }));
  const el = (await control.count()) ? control.first() : page.getByText(text, { exact: false }).first();
  await el.waitFor({ state: "visible", timeout: 5000 });
  await el.click();
  act(`click "${text}"${note ? `  — ${note}` : ""}`);
  await page.waitForTimeout(350);
}
async function fill(page, selector, value, note) {
  await page.locator(selector).first().fill(String(value));
  act(`type ${value} into ${selector}${note ? `  — ${note}` : ""}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });   // a phone, because this is a phone product
const page = await ctx.newPage();
const failures = [];
const guard = async (name, fn) => {
  try { await fn(); } catch (e) { failures.push(`${name}: ${e.message}`); log(`   ⛔ ${name}: ${e.message}`); }
};

// The walk MUTATES the stub - it presses save buttons. Reset first, or the second run measures the
// FIRST run's residue and reports it as a defect in the build. Measured: a second walk against an
// unchanged build failed because the first had already set that expense to 100/0, which correctly
// hides the button the second was looking for.
await fetch(`${STUB}/__reset`).catch(() => undefined);
log(`walk against ${BASE} (stub ${STUB}), viewport 390x844 - fixture reset\n`);

// ── LEG 1 — a new household through the wizard, answering בנפרד ───────────────────────────────
await guard("leg 1", async () => {
  screen("LEG 1 · new household through the wizard, answering בנפרד");
  await setMode("fresh");
  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  log(`   screen: ${await heading(page)}`);
  await click(page, "מתחילים", "welcome");
  log(`   screen: ${await heading(page)}  (household type)`);
  await click(page, "זוג", "household type — this is what makes the money question appear at all");
  // `TextInput` renders a bare `<input className="input">` with NO `type`, so a `[type="text"]`
  // selector matches nothing. Selecting on the class is what a person's eye does anyway.
  const texts = page.locator("input.input:not([type])");
  const n = await texts.count();
  for (let i = 0; i < n; i += 1) {
    const v = ["אבי", "בית שלנו", "חיפה"][i] ?? "x";
    await texts.nth(i).fill(v);
    act(`type "${v}" into text field ${i + 1} of ${n}`);
  }
  await click(page, "המשך");
  log(`   screen: ${await heading(page)}`);
  const lines = await visible(page);
  log(`   reads: ${lines.slice(0, 6).join(" / ")}`);
  await click(page, "בנפרד", "THE question this whole run is about");
  log(`   the ratio opened inline: ${(await visible(page)).includes("איך מתחלק?") ? "YES" : "NO"}`);
  await click(page, "יחס אחר", "not half-and-half");
  await fill(page, "#sep-share", 60, "the recorder's own share");
  log(`   partner's share shown as: ${(await visible(page)).find((l) => l.includes("החלק של בן")) ?? "(absent)"}`);
  // ── `AMENDMENT_18` §A68 / §A70 — **THE SCREEN THAT TAKES THE ANSWER, ASSERTED ON THAT SCREEN.**
  // §A70: a cell is not counted until it has been seen RED with the control removed — delete either
  // sentence from `SeparateAccountsStep` and the matching line below goes to RED.
  // ⚠️ ANTI-VACUITY FIRST, and this is the exact failure §A70 lists twice: assert we are ON the
  // step that carries the ratio before believing anything it says. `איך מתחלק?` is rendered by
  // this step and by no other.
  {
    const sep = await visible(page);
    const onSeparateStep = sep.includes("איך מתחלק?");
    log(`   is this really the ratio step? ${onSeparateStep ? "yes" : "🔴 NO - the two checks below prove nothing"}`);
    const namesTheEvent = sep.some((l) => l.includes("מתחיל לפעול כשמצטרף"));
    const namesTheIncome = sep.some((l) => l.includes("בהמשך נשאל על ההכנסה שלך בלבד"));
    log(`   §A68 names the event that makes it real?   ${namesTheEvent ? "yes" : "🔴 no"}`);
    log(`   §A68 names the question it changed?        ${namesTheIncome ? "yes" : "🔴 no"}`);
    if (!onSeparateStep || !namesTheEvent || !namesTheIncome) {
      failures.push(`§A68: separateStep=${onSeparateStep} event=${namesTheEvent} income=${namesTheIncome}`);
    }
  }
  await click(page, "המשך");
  log(`   screen: ${await heading(page)}   ← the CYCLE step comes between`);
  await click(page, "המשך");
  const incomeHeading = await heading(page);
  log(`   screen: ${incomeHeading}   ← the income step`);
  const income = await visible(page);
  log(`   reads: ${income.slice(2, 8).join(" / ")}`);
  // ⚠️ ANTI-VACUITY: the first cut of this check ran on the CYCLE screen, one step early, and
  // answered "no shared income asked" about a screen that never asks for one. Assert we are ON the
  // income step before believing its answer.
  // 🔴 **THE ANTI-VACUITY CHECK WAS ITSELF DEFEATED, BY A SENTENCE ADDED TWO STEPS EARLIER.** It
  // asked whether the visible TEXT contains `ההכנסה שלך` — and §A68's new line on the
  // separate-accounts step contains exactly that phrase, so the check answered "yes, this is the
  // income step" about the screen before it. **A text probe cannot tell a FIELD from a SENTENCE
  // ABOUT that field**, and copy is exactly the thing that moves between runs. The income step is
  // now identified by the INPUT it renders, which no paragraph anywhere can imitate.
  const ownIncomeField = await page.locator('input[aria-label="ההכנסה שלך"]').count();
  const managedField = await page.locator('input[aria-label="תקציב חודשי לניהול"]').count();
  const onIncomeStep = ownIncomeField > 0 || managedField > 0;
  log(`   is this really the income step? ${onIncomeStep ? "yes" : "🔴 NO - the check below proves nothing"}`);
  log(`   asks for MY OWN income?        ${ownIncomeField > 0 ? "yes" : "no"}   (the FIELD, not a sentence about it)`);
  log(`   asks for a SHARED household income? ${income.some((l) => l.includes("משק הבית")) ? "🔴 YES" : "no - this is the A56 root fix"}`);
  log(`   says it is private?            ${income.some((l) => l.includes("פרטית")) ? "yes" : "no"}`);

  // ⚠️ **WALK IT TO THE END. A SCREEN THAT ASKS AND AN ANSWER THAT LANDS ARE DIFFERENT CLAIMS,**
  // and the second is the one that was broken for sixteen runs. Everything below is asserted
  // against what the SERVER received, not against what the browser displayed.
  await page.locator("input.input.mono, input[inputmode=decimal]").first().fill("18000");
  act('type 18000 as MY OWN income');
  const budgets = page.locator("input[inputmode=decimal]");
  if (await budgets.count() > 1) { await budgets.nth(1).fill("9000"); act('type 9000 as the household budget'); }
  // ⚠️ **PRESS ON UNTIL THE WIZARD IS ACTUALLY FINISHED, AND ASSERT THAT IT WAS.** The first cut
  // clicked a fixed list of four labels, stopped on step 7 of 8, and then read `/__onboarding` —
  // which was still empty, so "no shared income in the payload" was answered about a payload that
  // had never been sent. The SECOND vacuous check in this file, after the one that ran on the cycle
  // screen. A walk that stops early and then asks a question gets a green that means nothing.
  for (let i = 0; i < 8; i += 1) {
    if ((await visible(page)).some((l) => l.includes("הבית מוכן"))) break;
    let moved = false;
    for (const label of ["סיום", "המשך", "דילוג"]) {
      try { await click(page, label); moved = true; break; } catch { /* try the next affordance */ }
    }
    if (!moved) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1200);
  const finished = (await visible(page)).some((l) => l.includes("הבית מוכן"));
  log(`   reached the done screen? ${finished ? "yes" : "🔴 NO - everything below is vacuous"}`);
  if (!finished) throw new Error("the wizard never completed, so the payload assertions would prove nothing");
  log(`   screen: ${await heading(page)}`);
  const doneLines = await visible(page);
  log(`   reads: ${doneLines.slice(1, 7).join(" / ")}`);
  const posted = await (await fetch(`${STUB}/__onboarding`)).json();
  const budget = posted?.baseline?.budget ?? {};
  log(`   POSTED budget keys: ${JSON.stringify(Object.keys(budget))}`);
  log(`   shared income in the payload? ${"income" in budget ? "🔴 YES - " + budget.income : "no - absent, not zero"}`);
  log(`   arrangement in the payload?   ${"separateAccounts" in (posted?.baseline?.profile ?? {}) ? "🔴 YES" : "no - it goes to the announcing route"}`);
  const stored = await (await fetch(`${STUB}/api/v1/households/current/separate-accounts`)).json();
  log(`   STORED arrangement: ${JSON.stringify(stored.defaultSplit)}  separateAccounts=${stored.separateAccounts}`);
});

// ── LEG 3 — the second person, from the invite link to the first screen they can act on ───────
await guard("leg 3", async () => {
  screen("LEG 3 · the second person accepts the invite");
  await setMode("populated");
  await page.goto(`${BASE}/join?token=walk-token`, { waitUntil: "networkidle" });
  log(`   screen: ${await heading(page)}`);
  await click(page, "הצטרף לבית", "the only button on the invite preview");
  await page.waitForTimeout(900);
  log(`   screen: ${await heading(page)}`);
  const d = await visible(page);
  log(`   reads:`);
  for (const l of d.slice(0, 8)) log(`      ${l}`);
  // ⚠️ WHICH SENTENCE IS CORRECT DEPENDS ON THE STORED RATIO, and leg 1 left this household with a
  // PENDING one — a single share, because the partner had not joined yet. Screen D must then state
  // NO number: `F-3`, and `A61` one step on, since guessing `חצי חצי` here would be the product
  // inventing the very percentage it is forbidden to invent. So the check asks the stub what is
  // stored and asserts the matching sentence, instead of expecting one and printing NO for the other.
  const stored = await (await fetch(`${STUB}/api/v1/households/current/separate-accounts`)).json();
  const bp = stored.defaultSplit.reduce((t2, x) => t2 + x.shareBp, 0);
  const resolvedRatio = stored.defaultSplit.length === 2 && bp === 10000;
  const statesNumber = d.some((l) => l.includes("תתחלק"));
  const statesPending = d.some((l) => l.includes("עדיין לא נקבע"));
  log(`   stored ratio is ${resolvedRatio ? "RESOLVED" : "PENDING"}, and the screen ${resolvedRatio === statesNumber && resolvedRatio !== statesPending ? "says the matching thing" : "🔴 says the WRONG thing"}`);
  log(`      -> "${(d.find((l) => l.includes("תתחלק") || l.includes("עדיין לא נקבע")) ?? "(neither)").trim()}"`);
  log(`   states income privacy? ${d.some((l) => l.includes("פרטית")) ? "yes" : "NO"}`);
  log(`   offers a way to object? ${d.some((l) => l.includes("לא נכונה")) ? "yes" : "NO"}`);
});

// ── LEG 4 + 5 — the partner's view of one expense, and the two named actions ──────────────────
await guard("legs 4 and 5", async () => {
  screen("LEGS 4 + 5 · one shared expense: the partner's view, and changing it");
  await page.goto(`${BASE}/shared-expenses?purchaseId=${PURCHASE}`, { waitUntil: "networkidle" });
  log(`   screen: ${await heading(page)}`);
  const g = await visible(page);
  log(`   reads: ${g.slice(0, 8).join(" / ")}`);
  log(`   a way back?  ${g.some((l) => l.includes("חזרה")) ? `yes — "${g.find((l) => l.includes("חזרה"))}"` : "🔴 NO"}`);
  log(`   "mine alone" offered as a NAMED action? ${g.some((l) => l.includes("אני נושא/ת בכל הסכום")) ? "yes" : "🔴 no"}`);
  await click(page, "אני נושא/ת בכל הסכום", "A65 — an intention, not a drag to 100; the LABEL says what it does");
  await page.waitForTimeout(600);
  log(`   after: ${(await visible(page)).slice(2, 6).join(" / ")}`);
});

// ── SPEC SCREEN E — the dashboard card. Deferred at run 18, built now. ───────────────────────
await guard("dashboard card", async () => {
  screen("E · the dashboard card - what the arrangement means, on the page an adult opens");
  await setMode("populated");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const v = await visible(page);
  // ⚠️ ANTI-VACUITY FIRST. A dashboard that failed to load renders LoadState and NOTHING below,
  // and every "the card is absent" check would then be green about a page that has no cards at
  // all. `שלום` is the greeting the page renders once `/me` and the budget have landed.
  const dashboardLoaded = v.some((l) => l.includes("שלום"));
  log(`   did the dashboard actually load? ${dashboardLoaded ? "yes" : "🔴 NO - every check below is vacuous"}`);
  const hasCard = v.some((l) => l.includes("הכסף שלך"));
  const hasRecorded = v.some((l) => l.includes("נרשמו על שמך"));
  const hasShare = v.some((l) => l.includes("החלק שלך"));
  const hasLink = v.some((l) => l.includes("מה שנרשם"));
  log(`   card present?          ${hasCard ? "yes" : "🔴 no"}`);
  log(`   נרשמו על שמך / החלק שלך: ${hasRecorded ? "yes" : "🔴 no"} / ${hasShare ? "yes" : "🔴 no"}`);
  log(`   a way to the detail?   ${hasLink ? "yes" : "🔴 no"}`);
  const window = v.find((l) => l.includes("מוצג מ־") || l.includes("כל ההיסטוריה"));
  log(`   states its RANGE?      ${window ? `yes - "${window}"` : "🔴 no - two totals with no window is a number nobody can place"}`);
  // `R-2` R2-4 — the two tiles cover DIFFERENT populations, and the card must say so, or a 60/40
  // household reads "נרשמו על שמך ₪1,000" beside "החלק שלך ₪900" as a 90% share.
  const populations = v.some((l) => l.includes("לא רק מאלה שרשמתם"));
  log(`   says the two tiles are DIFFERENT sets? ${populations ? "yes" : "🔴 no - it reads as a percentage of the tile beside it"}`);
  if (!populations) failures.push("screen E: the card does not say the two tiles cover different populations (R2-4)");
  if (!dashboardLoaded || !hasCard || !hasRecorded || !hasShare || !hasLink || !window) {
    failures.push(`screen E: loaded=${dashboardLoaded} card=${hasCard} recorded=${hasRecorded} share=${hasShare} link=${hasLink} window=${Boolean(window)}`);
  }

  // ⚠️ AND THE OTHER HALF, WHICH IS THE ONE PRODUCTION IS IN TODAY: an undeclared household must
  // get NO card, and must still get a dashboard. Absent, not empty and not an error.
  await setMode("dormant");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const off = await visible(page);
  const stillADashboard = off.some((l) => l.includes("שלום"));
  const cardGone = !off.some((l) => l.includes("נרשמו על שמך"));
  log(`   undeclared: dashboard still renders? ${stillADashboard ? "yes" : "🔴 no - a SEPACCT 404 broke an unrelated page"}`);
  log(`   undeclared: card absent?             ${cardGone ? "yes" : "🔴 no"}`);
  if (!stillADashboard || !cardGone) failures.push(`screen E dormant: dashboard=${stillADashboard} cardGone=${cardGone}`);
  await setMode("populated");
});

// ── The shells: F, H and the income page ─────────────────────────────────────────────────────
await guard("shells", async () => {
  screen("SHELLS · F, H and /my-income — the three pages that had no way back");
  for (const [path, name] of [["/settings/separate-accounts", "F · הפרדת כספים"], ["/my-record", "H · מה שנרשם"], ["/my-income", "ההכנסה שלי"]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const v = await visible(page);
    const back = v.find((l) => l.includes("חזרה"));
    log(`   ${path.padEnd(30)} h1="${await heading(page)}"  back=${back ? `"${back}"` : "🔴 NONE"}`);
    if (path === "/settings/separate-accounts") {
      log(`      children line: ${v.find((l) => l.includes("ילד")) ?? "(absent)"}`);
      log(`      auto-split stated: ${v.some((l) => l.includes("מתחלקות מעצמן")) ? "yes" : "no"}`);
    }
  }
});

// ── `R-2` BLOCKING 1 + 3 — THE PARTNER. Does the product give them a door, and does it open? ──
await guard("partner", async () => {
  screen("PARTNER · a plain adult_member - the person this feature exists for");
  await setMode("adult");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  const hub = await visible(page);
  const hasCard = hub.some((l) => l.includes("הפרדת כספים"));
  log(`   settings hub offers הפרדת כספים? ${hasCard ? "yes - they have a door" : "🔴 NO - no route to their own money"}`);
  if (hasCard) await click(page, "הפרדת כספים", "the only entrance a non-manager has");
  else await page.goto(`${BASE}/settings/separate-accounts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const v = await visible(page);
  log(`   screen: ${await heading(page)}`);
  for (const l of v.slice(3, 11)) log(`      ${l}`);
  const editable = await page.locator("input[type=checkbox], input[type=range]").count();
  log(`   editable controls shown to a non-manager: ${editable} ${editable === 0 ? "(read-only - the door does not open onto a refusal)" : "🔴 (a control that will fail on save)"}`);
  log(`   links to their own two screens? ${v.some((l) => l.includes("מה נרשם עליי")) && v.some((l) => l.includes("ההכנסה שלי")) ? "yes, both" : "🔴 no"}`);
  await setMode("populated");
});

log(`\n${failures.length ? `⛔ ${failures.length} leg(s) failed:\n  ${failures.join("\n  ")}` : "✅ every leg completed"}`);
await browser.close();
process.exit(failures.length ? 1 : 0);
