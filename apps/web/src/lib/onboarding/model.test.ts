// Pure unit tests for the onboarding wizard model.
// Run with:  node --experimental-strip-types --test src/lib/onboarding/model.test.ts
// (FE repo has no vitest; Node's built-in runner. model.ts is runtime-import-free.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  visibleSteps,
  pendingSplitBp,
  STEP_ORDER,
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
  redactDraftForStorage,
  DRAFT_TTL_MS,
  humanizeOnboardingError,
  buildStateFromBaseline,
  incomeRefusedNotice,
  INCOME_REFUSED_NOTICE,
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
  // SEPACCT stage 1 / `OD-5`. This line is a BRAND-NEW custom expense - the server has never
  // seen it and has therefore never named it - so no `id` key is sent and the server mints one.
  // ABSENT, never null.
  //
  // ⚠️ The assertion reads the same as it did before this stage and it does NOT mean the same
  // thing, which is why it is spelled out. Before, `buildOnboardingPayload` sent no id for ANY
  // line, including one seeded from a persisted baseline, and this cell was pinning that defect
  // green under the comment "fixed expense maps without a client id". The property that actually
  // changed is in the round-trip cell below, and that is the cell that would catch a regression.
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
  s.alerts = { ...s.alerts, weekly: true }; // non-sensitive structural progress — survives redaction
  s.displayName = "אבי";                    // sensitive — must NOT round-trip (WP-DRAFT-PRIVACY)
  const now = 1_000_000;
  saveDraft("user-1", s, now);
  const loaded = loadDraft("user-1", now);
  assert.equal(loaded?.alerts.weekly, true); // structural draft restored
  assert.equal(loaded?.displayName, "");     // name redacted, never persisted
  // different user → null
  assert.equal(loadDraft("user-2", now), null);
  // expired (> TTL) → null + purged
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

test("SEPACCT OD-5: a stored line's server uuid survives baseline -> wizard -> payload", () => {
  // THE ROUND TRIP IS THE PROPERTY, and a one-directional cell cannot see it. `?mode=edit`
  // re-enters the wizard from a PERSISTED baseline and POSTs a whole-document overwrite, so the
  // uuid has to survive two hops: `buildStateFromBaseline` must park it somewhere
  // (`WizardFixedExpense.key`), and `buildOnboardingPayload` must send it back out.
  //
  // WHAT THIS CATCHES that the presence cell above cannot: a payload builder that sends
  // `id: genId()`, or `id: f.sourcePresetId`, or that sends the key for preset lines only. All
  // three satisfy `"id" in fe === true`. Only the CUSTOM line (`uuid-x`, `sourcePresetId: null`)
  // discriminates them, because it is the line with no second axis to fall back on - which is
  // exactly why `SEPACCT_SPEC` 8.3 says preset lines were always stable and custom ones were not.
  const state = buildStateFromBaseline(
    { financialBaseline: fullBaseline(), name: "בית כהן", monthlyBudgetAmount: 9000, defaultCity: "תל אביב", budgetCycleDay: 5 },
    "אבי"
  );
  // The inactive custom line is `on: false` and `buildOnboardingPayload` filters those out, so
  // turn it on: the question is whether the uuid survives, not whether the line is active.
  for (const f of state.fixed) f.on = true;
  const sent = buildOnboardingPayload(state).baseline.fixedExpenses ?? [];
  const ids = new Map(sent.map((f) => [(f as Record<string, unknown>).label, (f as Record<string, unknown>).id]));
  assert.equal(ids.get("שכירות"), "uuid-rent");
  assert.equal(ids.get("חוג שחייה"), "uuid-x");
});

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

// ── WP-DRAFT-PRIVACY (NF-M23): finances/names must not sit in plaintext localStorage ──

test("redactDraftForStorage strips income, budget, sub-budgets, and names", () => {
  const state: WizardState = {
    ...createDefaultState(),
    income: 12345, managedBudget: 6789,
    displayName: "דנה", householdName: "בית כהן", city: "חיפה",
    subBudgets: { groceries: 500 } as WizardState["subBudgets"],
    fixed: [fixed({ label: "שכירות", amount: 4200 })]
  };
  const red = redactDraftForStorage(state);
  assert.equal(red.income, "");
  assert.equal(red.managedBudget, "");
  assert.equal(red.displayName, "");
  assert.equal(red.householdName, "");
  assert.equal(red.city, "");
  assert.deepEqual(red.subBudgets, {});
  assert.equal(red.fixed[0]!.amount, "");
  assert.equal(red.fixed[0]!.label, "שכירות"); // structural progress kept for resume
});

test("saveDraft does NOT persist income / budget-amount / household name to localStorage", () => {
  withWindow(() => {
    const state: WizardState = {
      ...createDefaultState(),
      income: 918273, managedBudget: 6789,
      displayName: "דנה", householdName: "בית כהן משפחתי", city: "חיפה",
      fixed: [fixed({ label: "שכירות", amount: 424242 })]
    };
    saveDraft("u1", state, 1000);
    const raw = (globalThis as unknown as { window: { localStorage: { getItem: (k: string) => string | null } } })
      .window.localStorage.getItem("pingtally_onb_draft_v1:u1") ?? "";
    assert.ok(raw.length > 0, "draft was written");
    assert.ok(!raw.includes("918273"), "income must not be persisted");
    assert.ok(!raw.includes("424242"), "fixed-expense amount must not be persisted");
    assert.ok(!raw.includes("בית כהן משפחתי"), "household name must not be persisted");
    assert.ok(raw.includes("שכירות"), "expense label kept so resume still restores position");
  });
});

test("DRAFT_TTL_MS is at most 24h (was 14 days)", () => {
  assert.ok(DRAFT_TTL_MS <= 24 * 60 * 60 * 1000, `TTL ${DRAFT_TTL_MS}ms exceeds 24h`);
});

// =============================================================================
// SEPACCT `AMENDMENT_15` §A56 / `AMENDMENT_16` §A60 - the client half of `A56-15`.
//
// The backend cell `apps/api/src/sepacct-income-roundtrip.gate.test.ts` measures the ROUND TRIP.
// It can only replay a payload SHAPE, because the wizard lives in this repository. These cells
// pin that the shape it replays is the one this wizard actually builds - the two together are the
// property, and either alone is the "unit test of one half" §A56 rules out.
// =============================================================================

const REDACTED_READ = {
  version: 1, mode: "quick",
  profile: { type: "couple", adults: 2, kids: 0, kidAges: [], cars: 1, separateAccounts: true },
  cycle: { basis: "calendar", startDay: 1, salaryDay: 10, incomeCount: 1 },
  // What the server serves an ARRANGED household: no `income` key at all, plus the mark.
  budget: { mode: "income", managedMonthlyBudget: 8000, incomeRedacted: true },
  fixedExpenses: [], subBudgets: {}, alerts: undefined
} as unknown as FinancialBaseline;

test("SEPACCT A56: a redacted read hydrates as redacted, and the empty income is the SERVER's gap", () => {
  const s = buildStateFromBaseline({ financialBaseline: REDACTED_READ, monthlyBudgetAmount: 8000 }, "אבי");
  assert.equal(s.incomeRedacted, true);
  assert.equal(s.income, "");            // withheld, NOT emptied by anyone
  assert.equal(s.separateAccounts, true);
});

test("SEPACCT A56: the mark travels back and NO rebuilt income is posted over the stored figure", () => {
  const s = buildStateFromBaseline({ financialBaseline: REDACTED_READ, monthlyBudgetAmount: 8000 }, "אבי");
  s.householdName = "בית"; s.city = "חיפה";
  const b = buildOnboardingPayload(s).baseline.budget as Record<string, unknown>;
  // 🔴 THE DEFECT, AS AN ASSERTION. `income` used to be rebuilt from flat state as `num("") === 0`
  //    and posted over a stored ₪20,000. There must be no key at all - absent, never null, never 0.
  assert.equal("income" in b, false, "a redacted read posted an income back - this is the ₪20,000 write");
  assert.equal(b.incomeRedacted, true, "the mark did not travel - the server cannot refuse a save that arrives after the arrangement ends");
  assert.equal(b.managedMonthlyBudget, 8000);
});

test("SEPACCT A56 negative control: an UNREDACTED read still sends the figure and no mark", () => {
  const s = createDefaultState();
  s.displayName = "א"; s.householdName = "ב"; s.city = "ג";
  s.budgetMode = "income"; s.income = 0; s.managedBudget = 9000;
  const b = buildOnboardingPayload(s).baseline.budget as Record<string, unknown>;
  // An honest zero from a read that was never redacted still lands - §A56 forbids a rule that
  // fires on the VALUE, and the backend cell `A56-2` is the other side of this one.
  assert.equal(b.income, 0);
  assert.equal("incomeRedacted" in b, false);
});

test("SEPACCT A60: the notice reads the SERVER's answer, and never infers one from the response", () => {
  // R-1, run 16. The first cut asked whether the RESPONSE was redacted. A household that DECLARES
  // in the same whole-document save is arranged in the response and refused nothing - carryOwnIncome
  // asks the state BEFORE the write. Measured over HTTP: the notice fired for 100% of households
  // choosing separate accounts, on a money surface, in Hebrew, saying an income that HAD been
  // stored was not - and in first run it short-circuited the completion step and kept the draft.
  assert.equal(incomeRefusedNotice({ incomeRefused: true }), INCOME_REFUSED_NOTICE);
  // The declaring save: the server stored the income and says so by omitting the key.
  assert.equal(incomeRefusedNotice({}), null);
  assert.equal(incomeRefusedNotice(undefined), null);
  assert.equal(incomeRefusedNotice({ incomeRefused: false }), null);
});

test("SEPACCT A60: the wizard can never change the arrangement, in EITHER direction", () => {
  // R-1, run 16, Finding 1. `separateAccounts: state.separateAccounts || undefined` made the
  // together card a one-way door - `false || undefined` drops the key - so the card moved, the save
  // returned 200, and the arrangement that hides every member's income stayed on. Sending the
  // boolean honestly is worse: carrySeparateAccounts refuses it for a STAMPED household (silently)
  // and lands an UNSTAMPED one otherwise, which /settings/separate-accounts then reports as joint
  // while the income step says separate. The key is not sent at all, and with it absent the server
  // carries the stored answer forward in both directions.
  const off = createDefaultState();
  off.displayName = "a"; off.householdName = "b"; off.city = "c"; off.managedBudget = 9000;
  const on: WizardState = { ...off, separateAccounts: true };
  for (const [label, st] of [["together", off], ["separate", on]] as const) {
    const profile = buildOnboardingPayload(st).baseline.profile as Record<string, unknown>;
    assert.equal("separateAccounts" in profile, false, `the wizard sent an arrangement answer (${label})`);
  }
  // Non-vacuity: the rest of the profile is still built from the same state, so the assertions
  // above are not green merely because `profile` came back empty.
  assert.equal((buildOnboardingPayload(on).baseline.profile as Record<string, unknown>).type, "family");
});

// ── `CC_UX_BUILD` item 4 — the wizard asks, and the answer becomes a ratio the backend can store ──

test("CC_UX item 4: a יחיד/ה household is never asked how it divides money with nobody", () => {
  const single = { householdType: "single" as const };
  const couple = { householdType: "couple" as const };
  // The step is only in STEP_ORDER at all when the UI flag is set; when it is, a one-person
  // household must still not see it. Both halves asserted so the cell cannot be green because the
  // flag happens to be unset in this process.
  assert.equal(visibleSteps(single).includes("separate"), false);
  assert.equal(visibleSteps(couple).includes("separate"), STEP_ORDER.includes("separate"));
  // And nothing ELSE moved: skipping one step must not reorder or drop the other eight.
  assert.deepEqual(
    visibleSteps(single),
    STEP_ORDER.filter((s) => s !== "separate"),
    "the single-household spine is not STEP_ORDER minus one step"
  );
});

test("CC_UX item 4: pendingSplitBp converts by string surgery and refuses what is not a ratio", () => {
  assert.equal(pendingSplitBp(50), 5000);
  assert.equal(pendingSplitBp(60), 6000);
  // 🔴 THE CASE THAT BREAKS `pct * 100`: 62.5 * 100 is 6250.000000000001 in binary floating point,
  //    and the wire refuses a non-integer shareBp with 400 split.invalid.
  assert.equal(pendingSplitBp(62.5), 6250);
  assert.equal(pendingSplitBp(33.33), 3333);
  // Not a ratio: nothing typed, the whole thing, nothing at all, and out of range.
  assert.equal(pendingSplitBp(""), null);
  assert.equal(pendingSplitBp(100), null, "100/0 is not a split, it is 'I pay everything'");
  assert.equal(pendingSplitBp(0), null);
  assert.equal(pendingSplitBp(-5), null);
  assert.equal(pendingSplitBp(120), null);
  assert.equal(pendingSplitBp(Number.NaN), null);
});

test("CC_UX item 4: a household answering בנפרד posts NO shared income - absent, not zero", () => {
  const s = createDefaultState();
  s.displayName = "א"; s.householdName = "ב"; s.city = "ג";
  s.separateAccounts = true;
  s.budgetMode = "income"; s.income = 24000; s.managedBudget = 9000; s.ownIncome = 18000;
  const b = buildOnboardingPayload(s).baseline.budget as Record<string, unknown>;
  assert.equal("income" in b, false, "a separate-accounts household posted a shared household income");
  assert.equal("incomeRedacted" in b, false, "a first-run household has no redaction to mark");
  assert.equal(b.managedMonthlyBudget, 9000, "the managed budget is the household's either way");
  // The own income is NOT in the baseline at all: it is per-member, private, and written by
  // `PUT …/my-income` after completion. A household document is the wrong place for it.
  assert.equal(JSON.stringify(buildOnboardingPayload(s)).includes("18000"), false,
    "the private own-income figure travelled inside the household baseline");
});

test("CC_UX item 4: an ALREADY-arranged household still sends the §A56 mark, not the omission", () => {
  // Both marks are set on this state, and they say different things. The redaction wins: this
  // document was built from a read with `budget.income` removed, and dropping the mark is what
  // lets a save arriving after the arrangement ends overwrite the stored figure with nothing.
  const s = buildStateFromBaseline({ financialBaseline: REDACTED_READ, monthlyBudgetAmount: 8000 }, "אבי");
  s.householdName = "בית"; s.city = "חיפה";
  assert.equal(s.separateAccounts, true, "the fixture no longer sets both marks - the cell is vacuous");
  assert.equal(s.incomeRedacted, true, "the fixture no longer sets both marks - the cell is vacuous");
  const b = buildOnboardingPayload(s).baseline.budget as Record<string, unknown>;
  assert.equal(b.incomeRedacted, true, "the separate-accounts omission swallowed §A56's mark");
  assert.equal("income" in b, false);
});

test("CC_UX item 4: under separate accounts the managed budget is required, the own income is not", () => {
  const s = createDefaultState();
  s.separateAccounts = true;
  s.managedBudget = ""; s.ownIncome = "";
  assert.notEqual(validateStep("income", s), null, "a separate-accounts household got through with no budget");
  s.managedBudget = 9000;
  assert.equal(validateStep("income", s), null, "the own income was made compulsory - it is private and optional");
});

test("R-3: the private own-income NEVER reaches the autosaved draft", () => {
  // 🔴 THE DEFECT, AS AN ASSERTION. `redactDraftForStorage` is a DENYLIST, so a field it does not
  //    name rides out on `...state`. `ownIncome` was typed under the promise that nobody else sees
  //    it and was written to plaintext localStorage 400ms later — and `coerceDraftState` never
  //    reads it back, so it leaked without even being returned to the person who typed it.
  const s = createDefaultState();
  s.separateAccounts = true;
  s.ownIncome = 18000;
  s.income = 24000;
  s.managedBudget = 9000;
  s.displayName = "אבי";
  const redacted = redactDraftForStorage(s);
  assert.equal(redacted.ownIncome, "", "the private own-income survived redaction");
  // The serialized form is what actually lands in localStorage, so assert against THAT: a field
  // stripped from the object but re-added by a spread somewhere else would pass the check above.
  const json = JSON.stringify({ savedAt: 0, userId: "u", state: redacted });
  assert.equal(json.includes("18000"), false, "the private figure is present in the serialized draft");
  // Non-vacuity: the sibling figures this redactor has always stripped are still stripped, so the
  // cell cannot be green because redaction stopped working altogether.
  assert.equal(redacted.income, "");
  assert.equal(redacted.managedBudget, "");
  assert.equal(redacted.displayName, "");
});
