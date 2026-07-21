import { test, expect } from "@playwright/test";
import { TARGETS, record, states } from "../lib/env";
import { open, contextFor, tabWalk, readFocused } from "../lib/helpers";

// Checklist §2 — keyboard only. Real Tab presses, real Enter/Escape, computed focus indicator.

for (const t of TARGETS) {
  test(`keyboard ${t.id}`, async ({ browser }, info) => {
    const context = await contextFor(browser, t);
    const page = await context.newPage();
    await open(page, t);

    const stops = await tabWalk(page);
    const noIndicator = stops.filter((s) => !s.endOfDocument && !s.hasIndicator)
      .map((s) => ({ tag: s.tag, name: s.name?.slice(0, 40), cls: s.cls?.slice(0, 60), outline: `${s.outlineStyle} ${s.outlineWidth}`, boxShadow: s.boxShadow }));
    const trapped = stops.filter((s) => s.trapped);
    // Tab leaving the document into the browser chrome is the NORMAL end of a walk, not a defect.
    const lost = stops.filter((s) => s.endOfDocument);

    record({ kind: "keyboard-tabwalk", browser: info.project.name, route: t.id, routeState: t.state,
             stopCount: stops.filter((s) => !s.endOfDocument).length,
             firstStop: stops[0] ? { tag: stops[0].tag, cls: stops[0].cls, name: stops[0].name } : null,
             noIndicator, trapped: trapped.length, reachedEndOfDocument: lost.length > 0,
             stops: stops.map((s) => ({ i: s.index, tag: s.tag, cls: (s.cls || "").slice(0, 40), name: (s.name || "").slice(0, 50), indicator: s.hasIndicator })) });

    expect.soft(stops.length, `${t.id}: at least one focusable stop`).toBeGreaterThan(0);
    expect.soft(trapped.length, `${t.id}: keyboard trap`).toBe(0);
    expect.soft(noIndicator, `${t.id}: focusable controls with NO computed focus indicator`).toEqual([]);
    // WebKit follows Safari's default "Tab moves between form controls only", so <a> elements —
    // including the skip link — are not in its Tab order. That is a platform default, not a site
    // defect, so the assertion is Chromium-only and the WebKit behaviour is reported as an
    // observation instead.
    if (info.project.name === "chromium") {
      expect.soft(stops[0]?.cls?.includes("skip-link"), `${t.id}: first Tab stop is the skip link`).toBe(true);
    }
    await context.close();
  });
}

test("accessibility menu: Escape closes and returns focus; no focus trap", async ({ browser }, info) => {
  const t = TARGETS[0];
  const context = await contextFor(browser, t);
  const page = await context.newPage();
  await open(page, t);

  const launcher = page.getByRole("button", { name: "תפריט נגישות" });
  await launcher.focus();
  await page.keyboard.press("Enter");
  await page.locator("#a11y-menu-panel").waitFor({ state: "visible" });
  const focusInPanelOnOpen = await page.evaluate(() =>
    Boolean(document.getElementById("a11y-menu-panel")?.contains(document.activeElement)));

  // Non-modal by design: Tab must be able to LEAVE the panel (a trap here is a bug).
  const seen: string[] = [];
  let escapedPanel = false;
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() =>
      Boolean(document.getElementById("a11y-menu-panel")?.contains(document.activeElement)));
    const f: any = await page.evaluate(readFocused);
    seen.push(`${f?.tag}.${(f?.cls || "").slice(0, 24)}`);
    if (!inside) { escapedPanel = true; break; }
  }

  // Reopen, then Escape.
  await page.keyboard.press("Escape");
  await launcher.focus();
  await page.keyboard.press("Enter");
  await page.locator("#a11y-menu-panel").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const closed = await page.locator("#a11y-menu-panel").isHidden();
  const focusReturned = await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.classList.contains("a11y-launcher") ?? false);

  // A control must never disable itself while focused (2.4.3 — focus would drop to <body>).
  const resetDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll<HTMLButtonElement>("#a11y-menu-panel button")]
      .find((x) => (x.textContent || "").includes("איפוס הגדרות"));
    return b ? b.disabled : null;
  });

  record({ kind: "keyboard-menu", browser: info.project.name, focusInPanelOnOpen, escapedPanel, tabPath: seen,
           escapeCloses: closed, focusReturnedToLauncher: focusReturned, resetButtonDisabled: resetDisabled });

  expect.soft(focusInPanelOnOpen, "focus moves into the panel on open").toBe(true);
  expect.soft(escapedPanel, "panel is NON-modal: Tab must be able to leave it (no trap)").toBe(true);
  expect.soft(closed, "Escape closes the panel").toBe(true);
  expect.soft(focusReturned, "Escape returns focus to the launcher").toBe(true);
  await context.close();
});

test("/l: focus is not lost to <body> after buy / undo / partial / missing / finish", async ({ browser }, info) => {
  // A dedicated, freshly seeded list this test is allowed to mutate.
  const token = (states.mutable as Record<string, string>)[info.project.name];
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/l/${token}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-share-item]").first().waitFor();

  const results: any[] = [];
  const afterAction = async (label: string, act: () => Promise<void>) => {
    await act();
    await page.waitForTimeout(900); // let the POST + refetch + re-render land
    const f: any = await page.evaluate(readFocused);
    results.push({ action: label, focusLost: f === null, focused: f ? `${f.tag}.${(f.cls || "").slice(0, 24)}|${(f.name || "").slice(0, 40)}` : "<body>" });
  };

  // buy (keyboard Enter on the first item)
  const first = page.locator("[data-share-item]").first();
  await first.focus();
  await afterAction("bought (Enter)", async () => { await page.keyboard.press("Enter"); });

  // undo — the item is now in the נקנה section, still a [data-share-item] button
  const boughtBtn = page.locator("section", { hasText: "נקנה" }).locator("[data-share-item]").first();
  await boughtBtn.focus();
  await afterAction("unbought (Enter)", async () => { await page.keyboard.press("Enter"); });

  // partial stepper +
  const plus = page.getByRole("button", { name: /הוסף כמות/ }).first();
  await plus.focus();
  await afterAction("partial + (Enter)", async () => { await page.keyboard.press("Enter"); });

  // missing toggle — aria-pressed must flip (4.1.2 state exposure)
  // scoped to <main>: the CLOSED accessibility panel also contains aria-pressed toggles,
  // and they come first in DOM order (A11yBar is the first child of <body>).
  const miss = page.locator('main button[aria-pressed]').first();
  const pressedBefore = await miss.getAttribute("aria-pressed").catch(() => null);
  await miss.focus();
  await afterAction("missing (Enter)", async () => { await page.keyboard.press("Enter"); });
  const pressedAfter = await page.locator('main button[aria-pressed]').first().getAttribute("aria-pressed").catch(() => null);

  // finish -> the whole page becomes the locked view
  const finish = page.getByRole("button", { name: /סיימתי את הקנייה/ });
  await finish.focus();
  await afterAction("finish (Enter)", async () => { await page.keyboard.press("Enter"); });
  await page.waitForTimeout(1200);
  const lockedH1 = await page.locator("h1").count();
  const lockedMain = await page.locator("main#main").count();

  record({ kind: "keyboard-l-actions", browser: info.project.name, token, results,
           missingAriaPressedBefore: pressedBefore, missingAriaPressedAfter: pressedAfter, lockedH1, lockedMain });

  expect.soft(pressedBefore, "missing toggle exposes aria-pressed").toBe("false");
  expect.soft(pressedAfter, "aria-pressed flips to true after activation").toBe("true");
  for (const r of results) expect.soft(r.focusLost, `focus lost to <body> after ${r.action}`).toBe(false);
  expect.soft(lockedH1, "locked view still has exactly one h1").toBe(1);
  expect.soft(lockedMain, 'locked view still has <main id="main">').toBe(1);
  await context.close();
});
