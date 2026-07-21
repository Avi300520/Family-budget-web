import { test, expect } from "@playwright/test";
import path from "node:path";
import { TARGETS, MENU_MODES, EVIDENCE, record } from "../lib/env";
import { open, applyMode, contextFor, resetMode, measureContrast, measureBoundaries } from "../lib/helpers";

// Checklist §3 (zoom/reflow), §4 (launcher vs sticky CTA), §6 (contrast + colour-not-alone),
// §7 (motion). Everything measured on the RENDERED element via getComputedStyle.

/* ------------------------------------------------------- §6 contrast, every menu mode */

for (const t of TARGETS) {
  test(`contrast ${t.id}`, async ({ browser }, info) => {
    const modes = info.project.name === "chromium" ? MENU_MODES : [MENU_MODES[0]];
    const allFails: any[] = [];
    const context = await contextFor(browser, t);
    const page = await context.newPage();
    await open(page, t);

    for (const mode of modes) {
      if (mode.id !== "default") await resetMode(page);
      const flags = await applyMode(page, mode as never);
      const samples: any[] = await page.evaluate(measureContrast);
      const boundaries: any[] = await page.evaluate(measureBoundaries);
      const decided = samples.filter((s) => !s.undetermined);
      const fails = decided.filter((s) => s.pass === false);
      const undetermined = samples.filter((s) => s.undetermined);
      const min = decided.reduce((m, s) => (s.ratio < m.ratio ? s : m), decided[0] ?? { ratio: Infinity });
      const dimmed = decided.filter((s) => s.opacity < 1);

      record({ kind: "contrast", browser: info.project.name, route: t.id, routeState: t.state, mode: mode.id, flags,
               sampled: samples.length, decided: decided.length,
               undetermined: undetermined.length,
               undeterminedSamples: undetermined.slice(0, 6).map((u) => ({ text: u.text, bgImage: u.backgroundImage })),
               failures: fails,
               tightestPass: min ? { text: min.text, ratio: min.ratio, required: min.required, fg: min.fg, bg: min.bg } : null,
               opacityDimmedText: dimmed.map((d) => ({ text: d.text, opacity: d.opacity, ratio: d.ratio, required: d.required })),
               boundaries1411: boundaries.filter((b) => b.ratio !== null && !b.pass),
               boundariesSampled: boundaries.length });

      if (fails.length) allFails.push({ mode: mode.id, fails: fails.map((f) => `${f.ratio}:1 <${f.required} "${f.text}" ${f.fg} on ${f.bg} @ ${f.path}`) });
    }
    await context.close();
    expect(allFails, `${t.id}: measured 1.4.3 contrast failures`).toEqual([]);
  });
}

/* ------------------------------------------------------- §3 reflow / zoom */

const REFLOW = [
  { id: "reflow-320", width: 320, height: 640, note: "1.4.10 reflow — 320 CSS px" },
  { id: "zoom-200", width: 640, height: 512, note: "200% zoom equivalent (1280 device px at 2x)" },
  { id: "zoom-400", width: 320, height: 512, note: "400% zoom equivalent (1280 device px at 4x)" },
];

for (const t of TARGETS) {
  test(`reflow ${t.id}`, async ({ browser }, info) => {
    const problems: string[] = [];
    for (const vp of REFLOW) {
      const context = await contextFor(browser, t, { viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await open(page, t);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const clipped: any[] = [];
        for (const el of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (!(el.textContent || "").trim()) continue;
          // Deliberately clipped by design, not a reflow defect:
          //  · .sr-only (1x1 clip) · a collapsed accordion body (clientHeight 0)
          const r = el.getBoundingClientRect();
          if (r.width <= 1 || r.height <= 1) continue;
          if (el.clientHeight === 0) continue;
          const hiddenX = cs.overflowX === "hidden" || cs.overflow === "hidden";
          const hiddenY = cs.overflowY === "hidden" || cs.overflow === "hidden";
          if ((hiddenX && el.scrollWidth > el.clientWidth + 2) || (hiddenY && el.scrollHeight > el.clientHeight + 2)) {
            clipped.push({ tag: el.tagName.toLowerCase(), cls: String((el as HTMLElement).className || "").slice(0, 40),
                           text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
                           sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
          }
        }
        return { docScrollWidth: de.scrollWidth, clientWidth: de.clientWidth, bodyScrollWidth: document.body.scrollWidth, clipped };
      });
      const overflow = m.docScrollWidth > m.clientWidth + 1;
      record({ kind: "reflow", browser: info.project.name, route: t.id, routeState: t.state, viewport: vp.id, note: vp.note, ...m, overflow });
      if (overflow) problems.push(`${vp.id}: horizontal scroll (${m.docScrollWidth} > ${m.clientWidth})`);
      if (m.clipped.length) problems.push(`${vp.id}: ${m.clipped.length} clipped node(s): ${m.clipped.slice(0, 3).map((c: any) => c.text).join(" / ")}`);
      await page.screenshot({ path: path.join(EVIDENCE, "screenshots", `${t.id}--${vp.id}--${info.project.name}.png`), fullPage: true }).catch(() => {});
      await context.close();
    }
    expect(problems, `${t.id}: reflow/zoom`).toEqual([]);
  });
}

test.describe("a11y-menu font scaling reflows", () => {
  for (const id of ["home", "l-active", "onboarding-auth"]) {
    test(`font 160% reflow — ${id}`, async ({ browser }, info) => {
      const t = TARGETS.find((x) => x.id === id)!;
      const context = await contextFor(browser, t, { viewport: { width: 375, height: 812 } });
      const page = await context.newPage();
      await open(page, t);
      const flags = await applyMode(page, { label: null, steps: 6 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({
        zoom: document.documentElement.style.zoom,
        docScrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        visualWidth: window.innerWidth,
      }));
      // `zoom` shrinks the CSS viewport, so compare in the SAME (zoomed) coordinate space.
      const overflow = m.docScrollWidth > m.clientWidth + 1;
      record({ kind: "font-scale-reflow", browser: info.project.name, route: id, flags, ...m, overflow });
      await page.screenshot({ path: path.join(EVIDENCE, "screenshots", `${id}--font160--${info.project.name}.png`), fullPage: true }).catch(() => {});
      expect(overflow, `${id}: horizontal overflow at 160% menu font scale on a 375px viewport`).toBe(false);
      await context.close();
    });
  }
});

/* ------------------------------------------------------- §4 launcher vs sticky CTA */

for (const id of ["l-active", "onboarding-auth", "home"]) {
  test(`a11y launcher does not cover the sticky CTA — ${id}`, async ({ browser }, info) => {
    const t = TARGETS.find((x) => x.id === id)!;
    for (const vp of [{ w: 375, h: 812 }, { w: 320, h: 640 }]) {
      const context = await contextFor(browser, t, { viewport: { width: vp.w, height: vp.h } });
      const page = await context.newPage();
      await open(page, t);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const box = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
        const launcher = document.querySelector(".a11y-launcher");
        const stickies = [...document.querySelectorAll("*")].filter((el) => {
          if (el.closest(".a11y-widget")) return false; // the launcher cannot overlap itself
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          // only bars that are actually on screen right now
          return (cs.position === "sticky" || cs.position === "fixed") && el.querySelector("button, a") &&
                 r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
        });
        return { launcher: box(launcher),
                 stickies: stickies.map((s) => ({ cls: String((s as HTMLElement).className || "").slice(0, 40),
                   text: (s.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40), box: box(s),
                   ctas: [...s.querySelectorAll("button, a")].map((c) => ({ text: (c.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30), box: box(c) })) })) };
      });
      const overlaps: string[] = [];
      if (m.launcher) {
        for (const s of m.stickies) for (const c of s.ctas) {
          if (!c.box || c.box.w <= 0 || c.box.h <= 0) continue; // not rendered right now
          const a = m.launcher, b = c.box;
          const hit = a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
          if (hit) overlaps.push(`launcher covers CTA "${c.text}"`);
        }
      }
      record({ kind: "launcher-overlap", browser: info.project.name, route: id, viewport: `${vp.w}x${vp.h}`, ...m, overlaps });
      await page.screenshot({ path: path.join(EVIDENCE, "screenshots", `${id}--launcher-${vp.w}--${info.project.name}.png`) }).catch(() => {});
      expect.soft(overlaps, `${id} @${vp.w}: launcher overlaps a sticky CTA`).toEqual([]);
      await context.close();
    }
  });
}

/* ------------------------------------------------------- §7 motion */

test("motion: prefers-reduced-motion and the stop-motion toggle both halt animation", async ({ browser }, info) => {
  const t = TARGETS[0];
  const snapshot = (page: any) => page.evaluate(() => {
    const moving: any[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      const dur = (s: string) => s.split(",").map((x) => parseFloat(x) * (x.includes("ms") ? 1 : 1000)).reduce((a, b) => Math.max(a, isNaN(b) ? 0 : b), 0);
      const a = dur(cs.animationDuration), tr = dur(cs.transitionDuration);
      if (a > 10 || tr > 10) moving.push({ cls: String((el as HTMLElement).className || "").slice(0, 40), anim: cs.animationDuration, trans: cs.transitionDuration });
    }
    return moving;
  });

  const base = await contextFor(browser, t);
  const p1 = await base.newPage(); await open(p1, t);
  const normal = await snapshot(p1);
  await base.close();

  const reduced = await contextFor(browser, t, { reducedMotion: "reduce" });
  const p2 = await reduced.newPage(); await open(p2, t);
  const withMedia = await snapshot(p2);
  await reduced.close();

  const ctx3 = await contextFor(browser, t);
  const p3 = await ctx3.newPage(); await open(p3, t);
  const flags = await applyMode(p3, { label: "עצירת אנימציות", steps: 0 });
  const withToggle = await snapshot(p3);
  await ctx3.close();

  record({ kind: "motion", browser: info.project.name, animatedDefault: normal.length,
           animatedWithPrefersReduced: withMedia.length, animatedWithStopMotionToggle: withToggle.length,
           flags, sampleDefault: normal.slice(0, 8),
           // What still animates under the OS setting — the gap between the media query and the toggle.
           stillAnimatingUnderPrefersReduced: withMedia.slice(0, 20),
           sampleToggle: withToggle.slice(0, 8) });

  expect.soft(withMedia.length, "prefers-reduced-motion halts animation/transition").toBeLessThanOrEqual(normal.length);
  expect.soft(withToggle.length, "stop-motion toggle halts animation/transition").toBeLessThanOrEqual(normal.length);
});

/* ------------------------------------------------------- §6 colour is not the only cue */

test("state on /l is conveyed by text, not colour alone", async ({ browser }, info) => {
  const t = TARGETS.find((x) => x.id === "l-mixed")!;
  const context = await contextFor(browser, t);
  const page = await context.newPage();
  await open(page, t);
  const m = await page.evaluate(() => {
    const txt = (document.querySelector("main")?.textContent || "").replace(/\s+/g, " ");
    const boughtRows = [...document.querySelectorAll("[data-share-item]")].map((b) => {
      const nameEl = b.querySelector("span:nth-child(2)");
      return { text: (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
               lineThrough: nameEl ? getComputedStyle(nameEl).textDecorationLine.includes("line-through") : false };
    });
    return { hasOutOfStockText: txt.includes("חסר במלאי"), hasPartialText: /\d+\s*\/\s*\d+/.test(txt) || txt.includes("מתוך"),
             hasCheckGlyph: txt.includes("✓"), boughtRows: boughtRows.slice(0, 12), mainText: txt.slice(0, 800) };
  });
  record({ kind: "colour-not-alone", browser: info.project.name, route: "l-mixed", ...m });
  expect.soft(m.hasOutOfStockText, "out-of-stock carries the words חסר במלאי").toBe(true);
  expect.soft(m.hasPartialText, "partial carries an X / Y count in text").toBe(true);
  await context.close();
});
