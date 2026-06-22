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
  coerceDraftState,
  humanizeOnboardingError,
  buildStateFromBaseline,
  type WizardState,
  type WizardFixedExpense
} from "./model.ts";
import type { FinancialBaseline } from "@shopping-assistant/shared-types";

function withWindow(run: () => void): void {
  const store: Record<string, string> = {};
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }
    }
  };
  try { run(); } finally { delete (globalThis as unknown as { window?: unknown }).window; }
}

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

test("validateStep: profile requires name/household/city (consent is no longer a wizard gate)", () => {
  const s = createDefaultState();
  // Consent is seeded true (captured passively at /login; checkboxes removed 2026-06-22).
  assert.equal(s.acceptTerms, true);
  assert.equal(s.acceptPrivacy, true);
  assert.ok(validateStep("profile", s)); // still invalid — empty name/household/city
  s.displayName = "אבי"; s.householdName = "לוי"; s.city = "תל אביב";
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

test("coerceDraftState repairs a corrupt/stale draft onto defaults; the result never crashes computeTotals", () => {
  const safe = coerceDraftState({
    displayName: "אבי",
    fixed: "not-an-array",        // wrong type → []
    subBudgets: null,             // wrong type → {}
    alerts: undefined,            // missing → defaults
    budgetMode: "nonsense",       // invalid enum → default
    income: "oops",               // invalid number → ""
    kidAges: ["7-12", "bad"]      // invalid bracket dropped
  });
  assert.ok(safe);
  assert.equal(safe!.displayName, "אבי");
  assert.deepEqual(safe!.fixed, []);
  assert.deepEqual(safe!.subBudgets, {});
  assert.equal(safe!.alerts.cat80, true);
  assert.equal(safe!.budgetMode, "income");
  assert.equal(safe!.income, "");
  assert.deepEqual(safe!.kidAges, ["7-12"]);
  assert.doesNotThrow(() => computeTotals(safe!)); // the pre-fix crash site
});

test("coerceDraftState keeps a fixed array but drops malformed entries", () => {
  const safe = coerceDraftState({
    fixed: [
      { label: "שכירות", reportCat: "home", amount: 6500, frequency: "monthly" },
      "garbage",
      { label: "bad freq", reportCat: "home", amount: 100, frequency: "fortnightly" } // freq → "monthly"
    ]
  });
  assert.ok(safe);
  assert.equal(safe!.fixed.length, 2);
  assert.equal(safe!.fixed[0]!.frequency, "monthly");
  assert.equal(safe!.fixed[1]!.frequency, "monthly"); // invalid coerced to default
  assert.doesNotThrow(() => totalMonthlyFixed(safe!));
});

test("coerceDraftState rejects a non-object payload (caller then clears the key)", () => {
  assert.equal(coerceDraftState("a-string"), null);
  assert.equal(coerceDraftState(42), null);
  assert.equal(coerceDraftState(null), null);
  assert.equal(coerceDraftState([1, 2]), null);
});

test("loadDraft purges + returns null when the stored state is not an object", () => {
  withWindow(() => {
    const key = "pingtally_onb_draft_v1:user-x";
    (globalThis as unknown as { window: { localStorage: { setItem: (k: string, v: string) => void; getItem: (k: string) => string | null } } })
      .window.localStorage.setItem(key, JSON.stringify({ savedAt: 1000, userId: "user-x", state: "corrupt" }));
    assert.equal(loadDraft("user-x", 1000), null);
    assert.equal(
      (globalThis as unknown as { window: { localStorage: { getItem: (k: string) => string | null } } }).window.localStorage.getItem(key),
      null
    ); // purged
  });
});

test("loadDraft repairs a partial draft instead of throwing", () => {
  withWindow(() => {
    const partial = createDefaultState();
    // Simulate a stale-schema payload: drop the fields the wizard reduces/iterates over.
    const broken = { ...partial, fixed: null, subBudgets: 5, alerts: "x" } as unknown as WizardState;
    saveDraft("user-y", broken, 1000);
    const loaded = loadDraft("user-y", 1000);
    assert.ok(loaded);
    assert.deepEqual(loaded!.fixed, []);
    assert.deepEqual(loaded!.subBudgets, {});
    assert.equal(loaded!.alerts.cat80, true);
    assert.doesNotThrow(() => computeTotals(loaded!));
  });
});

test("humanizeOnboardingError maps codes to Hebrew and never echoes raw server text", () => {
  assert.match(humanizeOnboardingError({ code: "validation.invalid", message: "Invalid request body" }), /לא תקינים/);
  assert.match(humanizeOnboardingError({ code: "auth.csrf_invalid" }), /התחברו שוב/);
  const generic = humanizeOnboardingError(new Error("boom: secret-internal-detail"));
  assert.match(generic, /נסו שוב/);
  assert.equal(generic.includes("secret-internal-detail"), false);
});

// ── buildStateFromBaseline (edit mode / late onboarding) ─────────────────────────
function fullBaseline(): FinancialBaseline {
  return {
    version: 1,
    mode: "precise",
    profile: { type: "couple", adults: 2, kids: 1, kidAges: ["4-6"], region: "חיפה", cars: 2 },
    cycle: { basis: "salary", startDay: 3, salaryDay: 9, creditDay: 12, incomeCount: 2 },
    budget: { mode: "income", income: 24000, managedMonthlyBudget: 9000 },
    fixedExpenses: [
      { id: "uuid-rent", sourcePresetId: "rent", isCustom: false, label: "שכירות", reportCat: "home", amount: 5000, frequency: "monthly", isEstimate: false, alertOnChange: true, billingDay: 1, isActive: true },
      { id: "uuid-x", sourcePresetId: null, isCustom: true, label: "חוג שחייה", reportCat: "kids", amount: 300, frequency: "monthly", isEstimate: false, alertOnChange: false, billingDay: null, isActive: false }
    ],
    subBudgets: { groceries: 2500, eating: 800 },
    alerts: { cat80: false, cat100: true, billUp: false, unusual: true, monthly: false, weekly: true }
  };
}

test("buildStateFromBaseline: round-trips a full baseline into wizard state", () => {
  const s = buildStateFromBaseline(
    { financialBaseline: fullBaseline(), name: "בית כהן", monthlyBudgetAmount: 9000, defaultCity: "תל אביב", budgetCycleDay: 5 },
    "אבי"
  );
  assert.equal(s.displayName, "אבי");
  assert.equal(s.householdName, "בית כהן");
  assert.equal(s.mode, "precise");
  assert.equal(s.householdType, "couple");
  assert.equal(s.adults, 2);
  assert.equal(s.kids, 1);
  assert.deepEqual(s.kidAges, ["4-6"]);
  assert.equal(s.city, "חיפה"); // baseline region overrides defaultCity
  assert.equal(s.cars, 2);
  assert.equal(s.basis, "salary");
  assert.equal(s.salaryDay, 9);
  assert.equal(s.creditDay, 12);
  assert.equal(s.incomeCount, 2);
  assert.equal(s.budgetMode, "income");
  assert.equal(s.income, 24000);
  assert.equal(s.managedBudget, 9000); // baseline managedMonthlyBudget wins
  assert.equal(s.managedTouched, true);
  assert.equal(s.fixed.length, 2);
  const rent = s.fixed.find((f) => f.key === "uuid-rent")!;
  assert.equal(rent.on, true); // isActive → on
  assert.equal(rent.emoji, "🏠"); // recovered from preset "rent"
  assert.equal(rent.amount, 5000);
  const swim = s.fixed.find((f) => f.key === "uuid-x")!;
  assert.equal(swim.on, false); // isActive:false → on:false
  assert.equal(swim.isCustom, true);
  assert.equal(swim.emoji, "💸"); // custom → generic glyph
  assert.deepEqual(s.subBudgets, { groceries: 2500, eating: 800 });
  assert.equal(s.alerts.weekly, true);
  assert.equal(s.alerts.cat80, false);
});

test("buildStateFromBaseline: pre-baseline household falls back to household fields", () => {
  const s = buildStateFromBaseline(
    { financialBaseline: null, name: "בית לוי", monthlyBudgetAmount: 6000, defaultCity: "ירושלים", budgetCycleDay: 10 },
    "דנה"
  );
  assert.equal(s.displayName, "דנה");
  assert.equal(s.householdName, "בית לוי");
  assert.equal(s.city, "ירושלים");
  assert.equal(s.managedBudget, 6000);
  assert.equal(s.managedTouched, true);
  assert.equal(s.startDay, 10);
  assert.equal(s.salaryDay, 10);
  // No baseline → defaults preserved for the rest.
  assert.equal(s.fixed.length, 0);
  assert.deepEqual(s.subBudgets, {});
});

test("buildStateFromBaseline: a corrupt/partial baseline never throws and uses defaults", () => {
  const bad = { version: 1, mode: "nonsense", profile: "oops", fixedExpenses: [42, { label: 5 }], subBudgets: { groceries: "x" }, alerts: { cat80: "yes" } } as unknown as FinancialBaseline;
  const s = buildStateFromBaseline({ financialBaseline: bad });
  const d = createDefaultState();
  assert.equal(s.mode, d.mode); // invalid enum → default
  assert.equal(s.householdType, d.householdType); // non-object profile ignored
  // Non-object fixed entries (42) are dropped; an object entry is coerced onto safe
  // defaults (label 5 → "", reportCat → "misc", amount → "") rather than crashing.
  assert.equal(s.fixed.length, 1);
  assert.equal(s.fixed[0]!.label, "");
  assert.equal(s.fixed[0]!.reportCat, "misc");
  assert.equal(s.fixed[0]!.amount, "");
  assert.deepEqual(s.subBudgets, {}); // non-number cap dropped
  assert.equal(s.alerts.cat80, d.alerts.cat80); // non-boolean alert ignored
});

test("buildStateFromBaseline: undefined source returns clean defaults", () => {
  const s = buildStateFromBaseline(undefined);
  assert.deepEqual(s, createDefaultState());
});
