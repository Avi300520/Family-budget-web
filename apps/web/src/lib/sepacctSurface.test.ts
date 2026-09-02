import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("separate onboarding separates private income from the shared-budget screen", () => {
  const page = source("../app/onboarding/page.tsx");
  const steps = source("../app/onboarding/steps.tsx");
  assert.match(page, /wizard\.stepKey === "income" && wizard\.state\.separateAccounts/);
  assert.match(page, /התקציב המשותף לניהול/);
  assert.match(page, /personal: \{ title: "הכסף האישי שלך"/);
  assert.match(steps, /export function PrivateMoneyStep/);
  assert.match(steps, /ההכנסה החודשית שלך \(רשות\)/);
  assert.doesNotMatch(steps, /\{false &&/);
});

test("pending single-adult ratio shows the implied waiting share and a truthful 100% total", () => {
  const settings = source("../app/settings/separate-accounts/page.tsx");
  assert.match(settings, /pendingSingle = arrangement\.state === "pending" && adults\.length === 1/);
  assert.match(settings, /החלק שמחכה למבוגר\/ת שיצטרף\/תצטרף/);
  assert.match(settings, /pct\(pendingSingle \? 10000 : total\)/);
});

test("the critical mobile path exposes purpose locators, including private-plan management", () => {
  const controls = source("../app/onboarding/controls.tsx");
  const onboarding = source("../app/onboarding/steps.tsx");
  const income = source("../app/my-income/page.tsx");
  const shell = source("../components/AppShell.tsx");
  assert.match(controls, /data-action=\{dataAction\}/);
  for (const action of ["set-display-name", "set-household-name", "set-private-income", "set-managed-budget"]) {
    assert.match(onboarding, new RegExp(`dataAction="${action}"`));
  }
  assert.match(income, /data-action="delete-own-income"/);
  assert.match(income, /data-action="save-own-private-plan"/);
  assert.match(income, /data-action="delete-own-private-plan"/);
  assert.match(shell, /data-action="open-navigation"/);
  assert.match(shell, /data-action=\{`navigate-/);
});
