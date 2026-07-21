import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { TARGETS, MENU_MODES, EVIDENCE, record } from "../lib/env";
import { open, applyMode, contextFor, resetMode } from "../lib/helpers";

// Checklist §1/§6 automated half: axe-core wcag2a+wcag2aa on every public route in every REAL
// state — AND (the CI gap) with the accessibility menu actually opened and each mode engaged.
const AXE_TAGS = ["wcag2a", "wcag2aa"];

fs.mkdirSync(path.join(EVIDENCE, "axe"), { recursive: true });

for (const t of TARGETS) {
  test(`axe ${t.id}`, async ({ browser }, info) => {
    // Menu modes are scanned on Chromium only (axe's colour-contrast evaluation is
    // Chromium-calibrated); WebKit scans the default palette. Stated in the report.
    const modes = info.project.name === "chromium" ? MENU_MODES : [MENU_MODES[0]];
    const failures: string[] = [];
    const context = await contextFor(browser, t);
    const page = await context.newPage();
    await open(page, t);

    for (const mode of modes) {
      if (mode.id !== "default") await resetMode(page); // one page load, every mode
      const flags = await applyMode(page, mode as never);

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      const file = `${t.id}--${mode.id}--${info.project.name}.json`;
      fs.writeFileSync(path.join(EVIDENCE, "axe", file), JSON.stringify(results, null, 2));

      record({
        kind: "axe", browser: info.project.name, route: t.id, routeState: t.state, mode: mode.id, flags,
        url: t.path, violations: results.violations.length,
        incomplete: results.incomplete.length,
        passes: results.passes.length,
        violationIds: results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
          targets: v.nodes.slice(0, 4).map((n) => String(n.target)) })),
        // "incomplete" = axe could not decide. Never counted as a pass anywhere in this report.
        incompleteIds: results.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
        evidence: `axe/${file}`,
      });

      if (results.violations.length) {
        failures.push(`${mode.id}: ${results.violations.map((v) => `${v.id}(${v.nodes.length})`).join(", ")}`);
      }
      await page.screenshot({ path: path.join(EVIDENCE, "screenshots", `${t.id}--${mode.id}--${info.project.name}.png`), fullPage: mode.id === "default" }).catch(() => {});
    }
    await context.close();

    expect(failures, `axe violations on ${t.id}`).toEqual([]);
  });
}
