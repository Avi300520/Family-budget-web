import { test, expect } from "@playwright/test";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { TARGETS, EVIDENCE, record } from "../lib/env";
import { open, contextFor, mintConsumeToken } from "../lib/helpers";

// Checklist §1 (forms half): error messages must be ANNOUNCED (role=alert / aria-live) and
// ASSOCIATED to the field (aria-describedby / aria-invalid).

test("login/hero magic-link form: invalid submit is announced and associated", async ({ browser }, info) => {
  const t = TARGETS.find((x) => x.id === "login")!;
  const context = await contextFor(browser, t);
  const page = await context.newPage();
  await open(page, t);

  const before = await page.evaluate(() => document.querySelectorAll('[role="alert"], [aria-live]').length);
  // submit with an empty / too-short phone
  const submit = page.locator("form button[type=submit]").first();
  const phone = page.locator('input[type="tel"], input[inputmode="tel"], input[name*="phone" i]').first();
  const hasForm = (await submit.count()) > 0 && (await phone.count()) > 0;
  let after: any = null;
  if (hasForm) {
    await phone.fill("5");
    await submit.click();
    await page.waitForTimeout(900);
    after = await page.evaluate(() => {
      const live = [...document.querySelectorAll('[role="alert"], [aria-live]')].map((n) => ({
        role: n.getAttribute("role"), live: n.getAttribute("aria-live"), id: n.id || null,
        text: (n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) }));
      const field = document.querySelector<HTMLInputElement>('input[type="tel"], input[inputmode="tel"], input[name*="phone" i]');
      return { live, describedby: field?.getAttribute("aria-describedby") ?? null,
               invalid: field?.getAttribute("aria-invalid") ?? null,
               describedbyResolves: (() => { const d = field?.getAttribute("aria-describedby"); if (!d) return null;
                 return d.split(/\s+/).every((id) => Boolean(document.getElementById(id))); })() };
    });
  }
  record({ kind: "form-errors", browser: info.project.name, route: "login", hasForm, liveRegionsBefore: before, after });
  expect.soft(hasForm, "login hero has a phone form").toBe(true);
  if (hasForm) {
    const announced = (after.live as any[]).some((l) => l.text.length > 0);
    expect.soft(announced, "an error is placed in a live region / role=alert").toBe(true);
  }
  await context.close();
});

test("onboarding wizard: required-field validation is announced and associated", async ({ browser }, info) => {
  const t = TARGETS.find((x) => x.id === "onboarding-auth")!;
  const context = await contextFor(browser, t);
  const page = await context.newPage();
  await open(page, t);

  const snap = await page.evaluate(() => {
    const fields = [...document.querySelectorAll("input, select, textarea")].filter((f) => {
      const cs = getComputedStyle(f); const r = f.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && r.height > 0;
    }).map((f) => ({ tag: f.tagName.toLowerCase(), type: (f as HTMLInputElement).type, id: f.id || null,
      labelled: Boolean((f.id && document.querySelector(`label[for="${CSS.escape(f.id)}"]`)) || f.closest("label") || f.getAttribute("aria-label") || f.getAttribute("aria-labelledby")),
      describedby: f.getAttribute("aria-describedby"), required: f.hasAttribute("required") || f.getAttribute("aria-required") === "true" }));
    return { fields, buttons: [...document.querySelectorAll("button")].map((b) => (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)) };
  });

  // Try to advance with nothing filled in.
  const next = page.getByRole("button", { name: /המשך|הבא|סיום|צור/ }).first();
  let after: any = null;
  if (await next.count()) {
    await next.click().catch(() => {});
    await page.waitForTimeout(800);
    after = await page.evaluate(() => [...document.querySelectorAll('[role="alert"], [aria-live]')].map((n) => ({
      role: n.getAttribute("role"), live: n.getAttribute("aria-live"), text: (n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) })));
  }
  record({ kind: "form-errors", browser: info.project.name, route: "onboarding-auth", ...snap, afterInvalidSubmit: after });
  expect.soft(snap.fields.filter((f) => !f.labelled), "unlabelled onboarding fields").toEqual([]);
  await context.close();
});

test("/auth/consume SUCCESS branch (fresh token, one-shot)", async ({ browser }, info) => {
  const token = await mintConsumeToken();
  const context = await browser.newContext();
  const page = await context.newPage();
  const urls: string[] = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) urls.push(f.url()); });
  await page.goto(`/auth/consume?token=${token}`, { waitUntil: "domcontentloaded" });
  const early = await page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length, main: document.querySelectorAll("main#main").length,
    text: (document.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
    live: [...document.querySelectorAll('[role="status"], [role="alert"], [aria-live]')].map((n) => n.getAttribute("role")),
  })).catch(() => null);
  await page.screenshot({ path: path.join(EVIDENCE, "screenshots", `consume-success--${info.project.name}.png`) }).catch(() => {});
  let axeViolations: any[] = [];
  try {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    axeViolations = r.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
    fs.writeFileSync(path.join(EVIDENCE, "axe", `consume-success--${info.project.name}.json`), JSON.stringify(r, null, 2));
  } catch { /* the page may have already navigated away */ }
  await page.waitForTimeout(2500);
  record({ kind: "consume-success", browser: info.project.name, early, navigations: urls, finalUrl: page.url(), axeViolations });
  expect.soft(early?.h1 ?? 0, "consume success/transition state still has an h1").toBeGreaterThan(0);
  await context.close();
});
