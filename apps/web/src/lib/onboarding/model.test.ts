// Pure unit tests for the onboarding wizard model.
// Run with:  node --experimental-strip-types --test src/lib/onboarding/model.test.ts
// (FE repo has no vitest; Node's built-in runner. model.ts is runtime-import-free.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultState,
  monthlyOf,
  totalMonthlyFixed,
  suggestedManagedBudget,
  computeTotals,
  effectiveCycleDay,
  validateStep,
  buildOnboardingPayload,
  autoSplitSubBudgets,
  saveDraft,
  loadDraft,
  clearDraft,
  type WizardState,
  type WizardFixedExpense
} from "./model.ts";

function fixed(partial: Partial<WizardFixedExpense>): WizardFixedExpense {
  return {
    key: "k", sourcePresetId: null, isCustom: false, on: true, label: "x",
    reportCat: "home", emoji: "🏠", amount: 0, frequency: "monthly",
    isEstimate: false, alertOnChange: false, billingDay: null, ...partial
  };
}

test("monthlyOf applies the V1 frequency factors", () => {
  assert.equal(monthlyOf(1200, "monthly"), 1200);
  assert.equal(monthlyOf(1200, "yearly"), 100);
  assert.equal(monthlyOf(1200, "quarterly"), 400);
  assert.equal(monthlyOf(1200, "bimonthly"), 600);
  assert.equal(monthlyOf(120, "weekly"), 520);
});

test("totalMonthlyFixed sums active items only", () => {
  const s = createDefaultState();
  s.fixed = [
    fixed({ amount: 1000, frequency: "monthly" }),
    fixed({ amount: 1200, frequency: "yearly" }),
    fixed({ amount: 9999, frequency: "monthly", on: false })
  ];
  assert.equal(totalMonthlyFixed(s), 1100);
});

test("suggestedManagedBudget = income − monthly fixed, never below 0", () => {
  const s = createDefaultState();
  s.income = 24000;
  s.fixed = [fixed({ amount: 6500, frequency: "monthly" })];
  assert.equal(suggestedManagedBudget(s), 17500);
  s.income = 100;
  assert.equal(suggestedManagedBudget(s), 0);
});

test("effectiveCycleDay clamps and follows basis", () => {
  const s = createDefaultState();
  s.basis = "calendar"; s.startDay = 15;
  assert.equal(effectiveCycleDay(s), 15);
  s.basis = "salary"; s.salaryDay = 99;
  assert.equal(effectiveCycleDay(s), 28);
});

test("computeTotals reports remaining = managed − allocated", () => {
  const s = createDefaultState();
  s.managedBudget = 10000;
  s.subBudgets = { groceries: 3000, eating: 1200 };
  const t = computeTotals(s);
  assert.equal(t.managed, 10000);
  assert.equal(t.allocated, 4200);
  assert.equal(t.remaining, 5800);
});

test("validateStep: profile requires name/household/city/consents", () => {
  const s = createDefaultState();
  assert.ok(validateStep("profile", s)); // invalid (empty)
  s.displayName = "אבי"; s.householdName = "לוי"; s.city = "תל אביב";
  s.acceptTerms = true; s.acceptPrivacy = true;
  assert.equal(validateStep("profile", s), null);
});

test("validateStep: budget-only path requires a managed amount; income-mode does not", () => {
  const s = createDefaultState();
  s.budgetMode = "budget";
  assert.ok(validateStep("income", s)); // no managed → invalid
  s.managedBudget = 8000;
  assert.equal(validateStep("income", s), null);
  const s2 = createDefaultState();
  s2.budgetMode = "income";
  assert.equal(validateStep("income", s2), null); // income optional
});

test("validateStep: active fixed expense needs an amount; custom needs a label", () => {
  const s = createDefaultState();
  s.fixed = [fixed({ amount: 0, on: true })];
  assert.ok(validateStep("fixed", s));
  s.fixed = [fixed({ amount: 500, on: true })];
  assert.equal(validateStep("fixed", s), null);
  s.fixed = [fixed({ isCustom: true, label: "  ", amount: 500, on: true })];
  assert.ok(validateStep("fixed", s));
});

test("buildOnboardingPayload: managed budget → monthlyBudgetAmount; income stays in baseline only", () => {
  const s = createDefaultState();
  s.displayName = "אבי"; s.householdName = "לוי"; s.city = "תל אביב";
  s.budgetMode = "income"; s.income = 24000; s.managedBudget = 17500;
  s.fixed = [fixed({ isCustom: true, label: "מנוי", reportCat: "subscriptions", amount: 199, frequency: "monthly" })];
  s.subBudgets = { groceries: 3000, clothing: 0 };
  const p = buildOnboardingPayload(s);
  assert.equal(p.monthlyBudgetAmount, 17500);
  assert.equal(p.baseline.budget?.managedMonthlyBudget, 17500);
  assert.equal(p.baseline.budget?.income, 24000); // income NOT in monthlyBudgetAmount
  assert.equal(p.acceptTerms, true);
  assert.equal(p.defaultCity, "תל אביב");
  // fixed expense maps without a client id; reportCat preserved
  const fe = p.baseline.fixedExpenses?.[0] as Record<string, unknown>;
  assert.equal("id" in fe, false);
  assert.equal(fe.reportCat, "subscriptions");
  assert.equal(fe.isActive, true);
  // zero / empty sub-budgets dropped
  assert.equal(p.baseline.subBudgets?.groceries, 3000);
  assert.equal("clothing" in (p.baseline.subBudgets ?? {}), false);
});

test("buildOnboardingPayload: budget-only path carries null income", () => {
  const s = createDefaultState();
  s.displayName = "א"; s.householdName = "ב"; s.city = "ג";
  s.budgetMode = "budget"; s.managedBudget = 9000;
  const p = buildOnboardingPayload(s);
  assert.equal(p.baseline.budget?.income, null);
  assert.equal(p.baseline.budget?.managedMonthlyBudget, 9000);
  assert.equal(p.monthlyBudgetAmount, 9000);
});

test("autoSplitSubBudgets distributes the whole pool", () => {
  const split = autoSplitSubBudgets(10000);
  const sum = Object.values(split).reduce<number>((a, b) => a + (b || 0), 0);
  assert.equal(sum, 10000); // last bucket absorbs the rounding remainder
});

test("draft: user-scoped save/load round-trips; expired + wrong-user are ignored", () => {
  const store: Record<string, string> = {};
  // Minimal localStorage shim for the node test environment.
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }
    }
  };
  const s = createDefaultState();
  s.displayName = "אבי";
  const now = 1_000_000;
  saveDraft("user-1", s, now);
  assert.equal(loadDraft("user-1", now)?.displayName, "אבי");
  // different user → null
  assert.equal(loadDraft("user-2", now), null);
  // expired (> 14d) → null + purged
  assert.equal(loadDraft("user-1", now + 15 * 24 * 60 * 60 * 1000), null);
  saveDraft("user-1", s, now);
  clearDraft("user-1");
  assert.equal(loadDraft("user-1", now), null);
  delete (globalThis as unknown as { window?: unknown }).window;
});
