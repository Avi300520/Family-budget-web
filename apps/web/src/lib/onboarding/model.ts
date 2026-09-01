// =============================================================================
// Onboarding wizard — pure model & helpers (Household Financial Baseline Builder)
//
// This module is deliberately RUNTIME-IMPORT-FREE (only `import type`, which is
// stripped at runtime) so it loads standalone under
// `node --experimental-strip-types --test` — the same constraint as
// authRouting.ts. The React wizard imports the state shape + helpers from here.
//
// ⚠️ The frequency factors below MIRROR `@shopping-assistant/shared-types`
//    MONTHLY_FACTOR / monthlyOf and exist here only so the live FE preview math is
//    node-testable without a workspace value-import. Keep the two in sync (the
//    backend is the source of truth for persistence/budget math). Factors are
//    fixed in V1, so drift risk is minimal.
// =============================================================================

import type {
  ReportCatId,
  FrequencyId,
  SubBudgetCatId,
  HouseholdProfileType,
  BudgetBasis,
  BudgetMode,
  FinancialBaselineMode,
  KidAgeBracket,
  BaselineAlerts,
  FinancialBaseline,
  OnboardingBaselineRequest
} from "@shopping-assistant/shared-types";

// ── Frequency normalization (mirror of shared-types) ───────────────────────────
export const MONTHLY_FACTOR: Record<FrequencyId, number> = {
  weekly: 52 / 12,
  monthly: 1,
  bimonthly: 1 / 2,
  quarterly: 1 / 3,
  yearly: 1 / 12
};

export const FREQUENCIES: ReadonlyArray<{ id: FrequencyId; labelHe: string }> = [
  { id: "weekly", labelHe: "שבועי" },
  { id: "monthly", labelHe: "חודשי" },
  { id: "bimonthly", labelHe: "דו-חודשי" },
  { id: "quarterly", labelHe: "רבעוני" },
  { id: "yearly", labelHe: "שנתי" }
];

export function monthlyOf(amount: number, frequency: FrequencyId): number {
  return Math.round((Number(amount) || 0) * (MONTHLY_FACTOR[frequency] ?? 1));
}

// ── Report categories (12 — display + custom-expense picker) ───────────────────
export const REPORT_CATEGORIES: ReadonlyArray<{ id: ReportCatId; labelHe: string; icon: string }> = [
  { id: "groceries", labelHe: "סופר ומזון", icon: "🛒" },
  { id: "eating", labelHe: "אוכל בחוץ", icon: "🍕" },
  { id: "clothing", labelHe: "ביגוד", icon: "👕" },
  { id: "kids", labelHe: "ילדים", icon: "🎨" },
  { id: "transport", labelHe: "תחבורה", icon: "⛽" },
  { id: "home", labelHe: "בית וחשבונות", icon: "🏠" },
  { id: "health", labelHe: "בריאות", icon: "💊" },
  { id: "subscriptions", labelHe: "מנויים", icon: "📺" },
  { id: "debt", labelHe: "הלוואות", icon: "🏦" },
  { id: "saving", labelHe: "חיסכון", icon: "🐷" },
  { id: "fun", labelHe: "בילויים", icon: "🎬" },
  { id: "misc", labelHe: "שונות", icon: "✨" }
];

// ── Sub-budget buckets (8 — variable budgets) ──────────────────────────────────
export const SUB_BUDGET_CATS: ReadonlyArray<{ id: SubBudgetCatId; labelHe: string; icon: string; weight: number }> = [
  { id: "groceries", labelHe: "קניות שוטפות וסופר", icon: "🛒", weight: 0.34 },
  { id: "eating", labelHe: "מסעדות וקפה", icon: "🍕", weight: 0.12 },
  { id: "clothing", labelHe: "ביגוד", icon: "👕", weight: 0.07 },
  { id: "kids", labelHe: "ילדים", icon: "🎨", weight: 0.12 },
  { id: "transport", labelHe: "תחבורה ודלק", icon: "⛽", weight: 0.13 },
  { id: "home", labelHe: "בית ותחזוקה", icon: "🔧", weight: 0.08 },
  { id: "fun", labelHe: "בילויים", icon: "🎬", weight: 0.09 },
  { id: "misc", labelHe: "שונות", icon: "✨", weight: 0.05 }
];

// ── Fixed-expense presets (18) ─────────────────────────────────────────────────
export interface FixedPreset {
  id: string;
  label: string;
  emoji: string;
  reportCat: ReportCatId;
  frequency: FrequencyId;
  isEstimate?: boolean;
}

export const FIXED_PRESETS: ReadonlyArray<FixedPreset> = [
  { id: "rent", label: "שכירות / משכנתא", emoji: "🏠", reportCat: "home", frequency: "monthly" },
  { id: "daycare", label: "גנים / צהרונים", emoji: "🎒", reportCat: "kids", frequency: "monthly" },
  { id: "school", label: "בית ספר", emoji: "🏫", reportCat: "kids", frequency: "monthly" },
  { id: "arnona", label: "ארנונה", emoji: "🏛️", reportCat: "home", frequency: "bimonthly", isEstimate: true },
  { id: "vaad", label: "ועד בית", emoji: "🧹", reportCat: "home", frequency: "monthly" },
  { id: "elec", label: "חשמל", emoji: "⚡", reportCat: "home", frequency: "bimonthly", isEstimate: true },
  { id: "water", label: "מים", emoji: "💧", reportCat: "home", frequency: "bimonthly", isEstimate: true },
  { id: "gas", label: "גז", emoji: "🔥", reportCat: "home", frequency: "bimonthly", isEstimate: true },
  { id: "internet", label: "אינטרנט", emoji: "📶", reportCat: "home", frequency: "monthly" },
  { id: "cellular", label: "סלולר", emoji: "📱", reportCat: "home", frequency: "monthly" },
  { id: "insure", label: "ביטוחים", emoji: "🛡️", reportCat: "home", frequency: "monthly" },
  { id: "health", label: "קופת חולים", emoji: "⚕️", reportCat: "health", frequency: "monthly" },
  { id: "loan", label: "הלוואות", emoji: "🏦", reportCat: "debt", frequency: "monthly" },
  { id: "car", label: "רכב / ליסינג", emoji: "🚗", reportCat: "transport", frequency: "monthly" },
  { id: "subs", label: "מנויים", emoji: "📺", reportCat: "subscriptions", frequency: "monthly" },
  { id: "helper", label: "עוזרת", emoji: "🧽", reportCat: "home", frequency: "monthly" },
  { id: "classes", label: "חוגים", emoji: "🎨", reportCat: "kids", frequency: "monthly" },
  { id: "savings", label: "חיסכון קבוע", emoji: "🐷", reportCat: "saving", frequency: "monthly" }
];

export const KID_AGE_BRACKETS: ReadonlyArray<KidAgeBracket> = ["0-3", "4-6", "7-12", "13-18"];

// ── Wizard state ───────────────────────────────────────────────────────────────
export interface WizardFixedExpense {
  /** Stable local React key. For a preset = preset id; for custom = generated id. */
  key: string;
  /**
   * SEPACCT stage 1 / `OD-5` - the SERVER-assigned uuid, present ONLY on a line that came back
   * from a persisted baseline, and absent on a line the user has just added.
   *
   * ⚠️ IT IS A SEPARATE FIELD FROM `key` ON PURPOSE, and the first version of this change used
   * `key` and was wrong. `key` is a LOCAL list key: `addCustom` sets it from `genId()`, which is
   * `crypto.randomUUID()`, so sending `key` meant every brand-new custom line arrived carrying an
   * identity the CLIENT chose. The server accepts any syntactic uuid, so it would have persisted
   * it - turning "server-assigned uuid, stable per household instance" into a claim the code no
   * longer honoured, and letting a manager re-point a new line onto an existing line's stored
   * split and price history by supplying that line's uuid. Raised by a cold review of stage 1.
   *
   * A line with no `serverId` sends NO `id` key at all (absent, never null), and the server mints
   * one - which is exactly the pre-existing behaviour for a line it has never seen.
   */
  serverId?: string;
  sourcePresetId: string | null;
  isCustom: boolean;
  /** Active (included) toggle. */
  on: boolean;
  label: string;
  reportCat: ReportCatId;
  /** Display emoji only — never persisted. */
  emoji: string;
  amount: number | "";
  frequency: FrequencyId;
  isEstimate: boolean;
  alertOnChange: boolean;
  billingDay: number | null;
}

export interface WizardState {
  mode: FinancialBaselineMode;
  // profile
  householdType: HouseholdProfileType;
  adults: number;
  kids: number;
  kidAges: KidAgeBracket[];
  displayName: string;
  householdName: string;
  city: string; // doubles as defaultCity (required by the backend contract)
  cars: number;
  /** The household's declaration; the named default is selected after a second adult joins. */
  /** Null until the household explicitly answers; neither card is a default. */
  separateAccounts: boolean | null;
  /**
   * `CC_UX_BUILD` item 4 — THE RECORDER'S OWN SHARE, AS A PERCENTAGE, AND NOTHING ELSE.
   *
   * The wizard asks the ratio on the same screen as the arrangement (spec screen A, "one new
   * screen, not two"), and at that moment the household has exactly ONE adult. `defaultSplit` is
   * keyed by `userId`, so the counterpart cannot be named yet: what is stored is this number as the
   * setter's own share, and the backend assigns the remainder when the second adult joins.
   *
   * ⚠️ `A61` — IT IS TYPED, NEVER DERIVED. There is no income-proportional option and no
   * `splitRule`: a ratio computed from a private figure publishes that figure on every shared
   * expense. A couple who wants 62/38 types 62.
   */
  separateSharePct: number | "";
  /**
   * `CC_UX_BUILD` item 4, spec screen B — THIS MEMBER'S OWN INCOME, PRIVATE.
   *
   * It is NOT part of the onboarding payload. `POST /onboarding/complete` writes the household
   * baseline, and a per-member income is not a household fact — it goes to `PUT …/my-income` after
   * completion, which is the only route that stores it and the only one that can read it back.
   * Keeping it out of the baseline is also the ROOT fix for the vanishing income (`A56`): a
   * household that answers "בנפרד" is never asked for a shared figure, so there is never a shared
   * figure to disappear.
   */
  ownIncome: number | "";
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  // cycle
  basis: BudgetBasis;
  startDay: number;
  salaryDay: number;
  creditDay: number;
  incomeCount: number;
  // income / managed budget
  budgetMode: BudgetMode;
  income: number | "";
  /**
   * SEPACCT / `AMENDMENT_15` §A56 + `AMENDMENT_16` §A60 — **THE SERVED READ HID `budget.income`.**
   *
   * The server sets `budget.incomeRedacted: true` on every read of an ARRANGED household's
   * baseline and removes `income` from it. Two things follow, and both are load-bearing:
   *
   *  1. `income` above is `""` because the figure was withheld, NOT because anybody emptied the
   *     field. `buildOnboardingPayload` must therefore send no `income` at all — a rebuilt `0` is
   *     the exact write that destroyed ₪20,000 in run 14 — and must send the MARK back, which is
   *     what the server refuses on when the arrangement ended between the read and this save.
   *  2. The income step renders read-only: the server will not store what is typed there, and a
   *     refusal that looks like success is the defect §A60 rules out.
   */
  incomeRedacted: boolean;
  managedBudget: number | "";
  /** Whether the user has manually edited the managed budget (so we stop auto-prefilling). */
  managedTouched: boolean;
  // fixed expenses
  fixed: WizardFixedExpense[];
  // sub-budgets
  subBudgets: Partial<Record<SubBudgetCatId, number>>;
  // alerts
  alerts: BaselineAlerts;
}

export const DEFAULT_ALERTS: BaselineAlerts = {
  cat80: true, cat100: true, billUp: true, unusual: true, monthly: true, weekly: false
};

export function createDefaultState(): WizardState {
  return {
    mode: "quick",
    householdType: "family",
    adults: 2,
    kids: 2,
    kidAges: [],
    displayName: "",
    householdName: "",
    city: "",
    cars: 1,
    separateAccounts: null,
    separateSharePct: 50,
    ownIncome: "",
    // Consent is captured passively at /login (browse-wrap per the /privacy page) and the backend
    // stamps consent_terms_at/consent_privacy_at unconditionally on completeOnboarding. Seed true so
    // the legacy consent gate in validateStep('profile') and the hardcoded acceptTerms/acceptPrivacy
    // wire payload stay satisfied without a UI checkbox (checkboxes removed from onboarding 2026-06-22).
    acceptTerms: true,
    acceptPrivacy: true,
    basis: "calendar",
    startDay: 1,
    salaryDay: 10,
    creditDay: 10,
    incomeCount: 1,
    budgetMode: "income",
    income: "",
    incomeRedacted: false,
    managedBudget: "",
    managedTouched: false,
    fixed: [],
    subBudgets: {},
    alerts: { ...DEFAULT_ALERTS }
  };
}

// ── Derived numbers ─────────────────────────────────────────────────────────────

/**
 * `CC_UX_BUILD` item 4 — the wizard's ratio, as the ONE share the backend can store today.
 *
 * At the end of onboarding the household has exactly one adult, and `defaultSplit` is keyed by
 * `userId`, so the only thing that can be written is the setter's own share with the counterpart
 * unnamed. `PUT /households/:id/separate-accounts` accepts exactly that shape while the household
 * has one active adult, stores it, and does NOT declare — the declaration is minted when the second
 * adult arrives and the remainder becomes theirs.
 *
 * ⚠️ **BASIS POINTS BY STRING SURGERY, NEVER `pct * 100`.** `62.5 * 100` is `6250.000000000001` in
 * binary floating point and the wire refuses a non-integer `shareBp` with `400 split.invalid`. The
 * same reason `agorotFromInput` exists one module over, and the same technique.
 *
 * Returns `null` for anything that is not a ratio a household could have meant: empty, out of
 * range, more than two decimals, or `100` — which is not a split at all but "I pay everything", and
 * which the pending shape explicitly excludes (`shareBp < 10000`) so that a household cannot leave
 * onboarding having accidentally declared its partner owes nothing.
 */
export function pendingSplitBp(pct: number | ""): number | null {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  const text = pct.toFixed(2);
  const match = /^(\d+)\.(\d{2})$/.exec(text);
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number(match[2]);
  if (!Number.isInteger(bp) || bp < 0 || bp > 10000) return null;
  return bp;
}
function num(v: number | ""): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function totalMonthlyFixed(state: WizardState): number {
  return state.fixed.reduce((sum, f) => (f.on ? sum + monthlyOf(num(f.amount), f.frequency) : sum), 0);
}

/** Income-mode suggested managed budget = income − monthly fixed (never below 0). */
export function suggestedManagedBudget(state: WizardState): number {
  return Math.max(0, num(state.income) - totalMonthlyFixed(state));
}

export interface WizardTotals {
  fixedMonthly: number;
  income: number;
  managed: number;
  allocated: number;
  remaining: number;
}

export function computeTotals(state: WizardState): WizardTotals {
  const fixedMonthly = totalMonthlyFixed(state);
  const managed = num(state.managedBudget);
  const allocated = Object.values(state.subBudgets).reduce<number>((s, v) => s + (v || 0), 0);
  return {
    fixedMonthly,
    income: num(state.income),
    managed,
    allocated,
    remaining: managed - allocated
  };
}

/** Effective day-of-month the budget cycle renews (1–28). */
export function effectiveCycleDay(state: WizardState): number {
  const day = state.basis === "salary" ? state.salaryDay : state.startDay;
  return Math.min(28, Math.max(1, Math.round(day) || 1));
}

// ── Validation (per step) ───────────────────────────────────────────────────────
export type StepKey = "welcome" | "profile" | "separate" | "privateIncome" | "cycle" | "income" | "fixed" | "budget" | "alerts" | "done";

// The separate-accounts step ships DORMANT with the rest of SEPACCT: with the flag off the wizard
// has no such step and asks no household about a feature whose every route answers 404.
// The env read is inlined rather than imported from ../sepacct because this module is deliberately
// runtime-import-free (see the header); ../sepacct.SEPACCT_UI_ENABLED is the same expression and is
// what every other call site uses.
export const STEP_ORDER: ReadonlyArray<StepKey> = ([
  "welcome", "profile", "separate", "privateIncome", "cycle", "income", "fixed", "budget", "alerts", "done"
] as StepKey[]).filter((step) => step !== "separate" || process.env.NEXT_PUBLIC_SEPACCT_UI === "1");

/**
 * `CC_UX_BUILD` item 4 — THE STEPS THIS PARTICULAR HOUSEHOLD IS ASKED, in order.
 *
 * `STEP_ORDER` above is the full spine and stays a constant: the dormancy proof reads it, and the
 * flag filter belongs to the build rather than to a household. This is the state-dependent view of
 * it, and the controller indexes off THIS.
 *
 * > Decision tree, spec v2: `יחיד/ה` is asked nothing. `זוג`, `משפחה` and `שותפים` are asked.
 *
 * ⚠️ A ONE-PERSON HOUSEHOLD IS NOT ASKED HOW IT DIVIDES ITS MONEY. There is nobody to divide it
 * with, the arrangement cannot be declared without a second adult, and asking is the seventh
 * question in a row for a person who can only answer it one way. This is a SKIP, not a hidden
 * control: the step is absent from the sequence, so the stepper's count is right and `back()` does
 * not land on a screen that renders nothing.
 *
 * ⚠️ IT IS DERIVED FROM `STEP_ORDER`, NEVER RE-LISTED. A second hand-written array is the shape
 * that drifts the first time a step is inserted into one of them.
 */
export function visibleSteps(state: Pick<WizardState, "householdType" | "separateAccounts">): ReadonlyArray<StepKey> {
  return STEP_ORDER.filter((step) =>
    (step !== "separate" || state.householdType !== "single")
    && (step !== "privateIncome" || (state.householdType !== "single" && state.separateAccounts === true)));
}

/** Returns null when the step is valid, or a Hebrew error message when it is not. */
export function validateStep(step: StepKey, state: WizardState): string | null {
  switch (step) {
    case "privateIncome":
      return null;
    case "separate":
      if (state.separateAccounts === null) return "בחרו איך תרצו לנהל את הכסף.";
      if (state.separateAccounts && pendingSplitBp(state.separateSharePct) === null) return "כתבו אחוז בין 0 ל-100.";
      return null;
    case "profile":
      if (!state.displayName.trim()) return "כתבו את השם שלכם.";
      if (!state.householdName.trim()) return "כתבו שם לבית.";
      // City/region is a precise-only detail; quick mode never asks for it, so it
      // must not block the profile step (defaultCity is sent as "" in that case).
      if (state.mode === "precise" && !state.city.trim()) return "כתבו עיר או אזור.";
      if (state.adults < 1) return "צריך לפחות מבוגר אחד.";
      if (!state.acceptTerms || !state.acceptPrivacy) return "צריך לאשר את התנאים ואת מדיניות הפרטיות.";
      return null;
    case "income":
      // `CC_UX_BUILD` item 4 — under separate accounts there IS no household income, so nothing can
      // derive the managed budget and the household has to state it. The own-income field is
      // deliberately NOT required: it is private, it is written by a different route after
      // completion, and blocking the wizard on it would make a private figure feel compulsory.
      if (state.separateAccounts) return num(state.managedBudget) > 0 ? null : "כתבו תקציב חודשי לניהול.";
      // Income is optional in income-mode; a managed budget is required in budget-mode.
      if (state.budgetMode === "budget" && num(state.managedBudget) <= 0) return "כתבו תקציב חודשי לניהול.";
      return null;
    case "fixed":
      for (const f of state.fixed) {
        if (!f.on) continue;
        if (f.isCustom && !f.label.trim()) return "תנו שם להוצאה הקבועה שהוספתם.";
        if (num(f.amount) <= 0) return "מלאו סכום לכל הוצאה קבועה פעילה (או הסירו אותה).";
      }
      return null;
    case "budget":
      if (num(state.managedBudget) <= 0) return "אשרו תקציב חודשי לניהול.";
      return null;
    default:
      return null;
  }
}

// ── Payload building ─────────────────────────────────────────────────────────────
export interface OnboardingPayload {
  displayName: string;
  householdName: string;
  monthlyBudgetAmount: number;
  defaultCity: string;
  budgetCycleDay: number;
  acceptTerms: true;
  acceptPrivacy: true;
  baseline: OnboardingBaselineRequest;
}

export function buildOnboardingPayload(state: WizardState): OnboardingPayload {
  const managed = num(state.managedBudget);
  const subBudgets: Partial<Record<SubBudgetCatId, number>> = {};
  for (const [k, v] of Object.entries(state.subBudgets)) {
    if (typeof v === "number" && v > 0) subBudgets[k as SubBudgetCatId] = Math.round(v);
  }
  const baseline: OnboardingBaselineRequest = {
    version: 1,
    mode: state.mode,
    profile: {
      type: state.householdType,
      adults: state.adults,
      kids: state.kids,
      kidAges: state.kids > 0 ? state.kidAges : [],
      region: state.city.trim() || undefined,
      cars: state.cars
      // ── SEPACCT `AMENDMENT_16` §A60 — **THE WIZARD ASKS; IT DOES NOT DECIDE.**
      //    `separateAccounts` IS DELIBERATELY NOT SENT, AND `R-1` MEASURED BOTH REASONS.
      //
      // It used to send `state.separateAccounts || undefined`, which is a one-way door in the most
      // literal sense: `false || undefined` drops the key, so the wizard could turn an arrangement
      // ON and was PHYSICALLY INCAPABLE of turning it off. Clicking "ביחד" and saving returned
      // `200 OK`, moved the card, and changed nothing — the exact silent refusal §A60 forbids, on
      // the setting that hides every member's income and re-attributes every shared expense.
      //
      // And sending the boolean honestly is WORSE, not better. `carrySeparateAccounts` makes a
      // STAMPED household's stored answer win, so `false` would still be refused — silently — for
      // exactly the households that have really declared. Where it is NOT refused it lands an
      // UNSTAMPED answer (`AR-5`): the income strip fires on the raw boolean while the arrangement
      // route reports `sepacctDeclared`, which needs the stamp — so `/settings/separate-accounts`
      // says the accounts are joint in the same second this wizard's income step says they are
      // separate, no start notice fires, and the household holds an arrangement the `PUT` would
      // have REJECTED (no second adult, no validated split). The wizard cannot mint a declaration
      // instant and must not pretend to.
      //
      // 🔑 **THE ARRANGEMENT HAS A SURFACE AND THIS IS NOT IT**: `/settings/separate-accounts`
      // posts the announcing `PUT`, which validates the split, refuses a child or a non-member,
      // mints the stamp and fires the start notice. With the key ABSENT, `carrySeparateAccounts`
      // carries the stored answer forward in BOTH directions, so this whole-document write cannot
      // change the arrangement at all — which is the property. The step now says where the answer
      // is made instead of offering a control that cannot make it.
    },
    cycle: {
      basis: state.basis,
      startDay: state.startDay,
      salaryDay: state.salaryDay,
      creditDay: state.mode === "precise" ? state.creditDay : undefined,
      incomeCount: state.mode === "precise" ? state.incomeCount : 1
    },
    budget: {
      mode: state.budgetMode,
      managedMonthlyBudget: managed,
      // ── SEPACCT `AMENDMENT_15` §A56 / `AMENDMENT_16` §A60 — A REDACTED READ IS NOT AN EMPTY
      //    FIELD, AND THIS IS THE HALF THAT LIVES IN THIS REPOSITORY ──────────────────────────
      //
      // `POST /onboarding/complete` is a WHOLE-DOCUMENT overwrite. Under separate accounts the
      // server removes `budget.income` from every read — including the owner's — and this wizard
      // rebuilds `budget` from named fields rather than spreading the served document. So the gap
      // rendered as an empty number input and posted back an explicit `0`: measured over HTTP on
      // run 14, ₪20,000 → 0, permanent.
      //
      // 🔑 **BOTH HALVES, AND NEITHER IS THE OTHER'S BACKUP.** Omitting `income` means there is no
      // rebuilt zero to refuse in the first place. Carrying `incomeRedacted` is what makes the
      // server refuse a write that arrives AFTER the arrangement ended — by then its own
      // `sepacctArranged(existing)` answers "no", which is a different question from "was the
      // document I am being handed derived from a redacted read". `A56-15` measured that gap and
      // this is the client side of closing it: §A60 ships the two repositories as one release.
      // ── `CC_UX_BUILD` item 4 — **THE ROOT FIX, AND IT IS AN OMISSION RATHER THAN A HANDLER.**
      //
      // A household that answered "בנפרד" was never asked for a shared household income (spec
      // screen B asks for THEIR OWN, which is private and goes to `PUT …/my-income`). So there is
      // no shared figure in this payload at all — not `0`, not `null`, ABSENT.
      //
      // 🔑 THIS IS UPSTREAM OF §A56 RATHER THAN A SECOND COPY OF IT. §A56 exists because the
      // server redacts `budget.income` from an arranged household's read and this wizard rebuilds
      // `budget` from named fields, so the gap came back as an explicit `0` and destroyed ₪20,000.
      // Both halves of that fix stay exactly as they are, for every household that already has a
      // shared income. What changes is that a household declaring HERE never acquires one, so the
      // disappearance has nothing to disappear — better than explaining it after the fact.
      //
      // ⚠️ **`incomeRedacted` IS TESTED FIRST, AND THE ORDER IS THE WHOLE CORRECTNESS OF THIS BLOCK.**
      // A household that ALREADY declared and re-enters the wizard (`?mode=edit`, or a draft
      // hydrated from a redacted read) carries BOTH marks: `separateAccounts` because it is
      // arranged, and `incomeRedacted` because the read it was built from had `budget.income`
      // removed. Those say different things. The second one says *the document in my hands is
      // missing a figure that is still stored on the server*, and dropping it is what lets a save
      // arriving after the arrangement ends overwrite ₪20,000 with nothing — the exact write §A56
      // was written to refuse. So the MARK wins, and the omission below applies only to a household
      // answering here for the first time, which by construction has no stored figure to protect.
      ...(state.incomeRedacted
        ? { incomeRedacted: true as const }
        : state.separateAccounts
          ? {}
          : { income: state.budgetMode === "income" ? num(state.income) : null })
    },
    fixedExpenses: state.fixed
      .filter((f) => f.on)
      .map((f) => ({
        // SEPACCT stage 1 / `OD-5` (`SEPACCT_SPEC` 8.3) - SEND THE LINE'S SERVER ID BACK.
        //
        // `POST /onboarding/complete` is a WHOLE-DOCUMENT overwrite and serves `?mode=edit` as
        // well as first run. The server's `normalizeFinancialBaseline` PRESERVES a supplied id
        // and mints a fresh uuid only when none arrives - so with no id sent, every line's uuid
        // was regenerated on every save. Preset lines survived anyway because `sourcePresetId`
        // is sent and preserved; CUSTOM lines did not, and their price-observation history
        // (`lastObservedAmount`, matched on this id) was orphaned on every wizard edit. That is
        // `S-166`'s remaining half.
        //
        // `f.serverId` is set ONLY by `fixedFromBaseline`, i.e. only for a line that came back
        // from a persisted baseline. A line the user has just added has none and the key is
        // OMITTED entirely - absent, never null - so the server mints a uuid exactly as before.
        //
        // ⚠️ IT IS DELIBERATELY NOT `f.key`, and the first version of this change used `f.key`
        // and was wrong. `addCustom` sets `key` from `genId()`, which is `crypto.randomUUID()`,
        // so `f.key` would have made every brand-new custom line arrive with a CLIENT-chosen
        // identity that the server would then persist. Raised by a cold review of stage 1.
        //
        // 🔴 **THIS IS NO LONGER INERT, AND THE SENTENCE THAT USED TO SIT HERE SAID IT WAS.**
        // `R-2` caught it. The old note read *"this half is inert on its own ... both halves
        // shipped together"*, which was true when written and is false now: the BACKEND half is
        // DEPLOYED (`fixedExpenseInputSchema` accepts `id` at `packages/validation/src/index.ts`,
        // and `6d48240` is an ancestor of the live `41680ca`), while this frontend half is not
        // merged. They did not ship together and they are not shipping together.
        //
        // ⚠️ SO THIS IS THE ONE SEPACCT-BRANCH CHANGE THAT ALTERS LIVE BEHAVIOUR WITH
        // `NEXT_PUBLIC_SEPACCT_UI` UNSET, AND IT IS REACHABLE TODAY. Any owner or admin re-saving
        // the wizard through `?mode=edit` posts a key `origin/main` never posted, and the deployed
        // server acts on it (`normalizeFinancialBaseline`: `supplied ?? randomUUID()`). The effect
        // is the intended fix - custom lines keep their uuid instead of orphaning their price
        // history every save - but it is a behavioural difference from `origin/main`, not a
        // no-op, and the dormancy claim has to name it rather than assume it away.
        ...(f.serverId ? { id: f.serverId } : {}),
        sourcePresetId: f.sourcePresetId,
        isCustom: f.isCustom,
        label: f.label.trim(),
        reportCat: f.reportCat,
        amount: num(f.amount),
        frequency: f.frequency,
        isEstimate: f.isEstimate,
        alertOnChange: f.alertOnChange,
        billingDay: f.billingDay,
        isActive: true
      })),
    subBudgets,
    alerts: state.alerts
  };
  return {
    displayName: state.displayName.trim(),
    householdName: state.householdName.trim(),
    monthlyBudgetAmount: managed,
    defaultCity: state.city.trim(),
    budgetCycleDay: effectiveCycleDay(state),
    acceptTerms: true,
    acceptPrivacy: true,
    baseline
  };
}

/**
 * ── SEPACCT `AMENDMENT_16` §A60 — **THE REFUSAL THE CLIENT COULD NOT SEE** ────────────────────
 *
 * `POST /onboarding/complete` answers `200 OK` and returns the household it stored. When the
 * household is under separate accounts it REFUSES the incoming `budget.income` and keeps the
 * stored figure — a legitimate protection, and until now an invisible one: everything else the
 * person edited was saved, one field was not, and nothing said so.
 *
 * `IncomeStep` already prevents the common case: a read that came back marked renders no income
 * input, and `buildOnboardingPayload` then sends no figure. This closes the one the client cannot
 * prevent — **the arrangement was declared between our read and our save** (a partner in WhatsApp,
 * a second tab). We sent a figure believing it writable and the server dropped it.
 *
 * 🔴 **IT READS THE SERVER'S OWN ANSWER (`incomeRefused`) AND MUST NOT INFER ONE. `R-1` MEASURED
 * WHAT INFERRING COSTS.** The first cut asked whether the RESPONSE was redacted — which is a
 * different question from *was the value I sent dropped*, and the two disagree in exactly one case
 * that is not a race: **the save that declares the arrangement itself.** `carryOwnIncome` refuses
 * on the state BEFORE the write, and a household that declares in the same whole-document save is
 * arranged AFTER it. So the notice fired for **every** household that chose "בנפרד", first run and
 * edit alike, telling them in Hebrew on a money surface that an income which HAD been stored was
 * not — and in first run it also short-circuited the completion step and left the draft behind.
 *
 * 🔑 **A refusal signal that fires on non-refusals is worse than no signal: it trains people to
 * dismiss the one that means something.** The server now reports the refusal it performed, from
 * the one predicate that knows (`ownIncomeWriteRefused`, asked of the PRIOR household).
 */
export const INCOME_REFUSED_NOTICE =
  "השאר נשמר. ההכנסה לא נשמרה: בבית הזה החשבונות מנוהלים בנפרד, ואין הכנסה משותפת לשמור. ההכנסה של כל אחד פרטית ונשמרת אצלו.";

export function incomeRefusedNotice(saved: { incomeRefused?: boolean } | undefined): string | null {
  return saved?.incomeRefused === true ? INCOME_REFUSED_NOTICE : null;
}

// ── Sub-budget auto-split (round to ₪50, last bucket absorbs remainder) ──────────
export function autoSplitSubBudgets(pool: number): Partial<Record<SubBudgetCatId, number>> {
  const out: Partial<Record<SubBudgetCatId, number>> = {};
  let used = 0;
  SUB_BUDGET_CATS.forEach((c, i) => {
    let v = Math.round((Math.max(0, pool) * c.weight) / 50) * 50;
    if (i === SUB_BUDGET_CATS.length - 1) v = Math.max(0, pool - used);
    out[c.id] = v;
    used += v;
  });
  return out;
}

// ── localStorage draft (user-scoped, short TTL, finances/names redacted before write) ──
const DRAFT_PREFIX = "pingtally_onb_draft_v1";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (was 14 days) — PII-minimized draft

export function draftKey(userId: string): string {
  return `${DRAFT_PREFIX}:${userId}`;
}

interface DraftEnvelope {
  savedAt: number;
  userId: string;
  state: WizardState;
}

/**
 * PII minimization (NF-M23 / WP-DRAFT-PRIVACY). The autosaved onboarding draft must NOT
 * persist the household's finances or names in plaintext localStorage. Strip income, the
 * managed budget, every fixed-expense amount, the sub-budget amounts, and the display /
 * household / city names before writing. Structural progress (step position, counts,
 * toggles, expense labels/frequencies) is kept so a resumed draft restores position; the
 * sensitive numbers and names are simply re-entered.
 */
export function redactDraftForStorage(state: WizardState): WizardState {
  return {
    ...state,
    income: "",
    // ── 🔴 `R-3` FINDING 1 — **THE ONE FIGURE THE PRODUCT PROMISES NOBODY ELSE CAN SEE WAS THE
    //    ONE IT WROTE TO PLAINTEXT `localStorage`.** ─────────────────────────────────────────────
    //
    // `ownIncome` is this sprint`s addition, and this redactor is a DENYLIST: a field it does not
    // name rides out on `...state`. Typed under the promise *"פרטית. בן/בת הזוג לא רואה את המספר
    // הזה"*, it was autosaved in cleartext 400ms later — and `coerceDraftState` below is an
    // ALLOWLIST that never reads it back, so the value was write-only. It leaked and was not even
    // returned to the person who typed it.
    //
    // ⚠️ THE SHAPE IS THE DEFECT, NOT THE FIELD. A denylist beside an allowlist, ninety lines
    // apart, means every future field is private-by-forgetting. Named here because the fix below is
    // the narrow one; inverting this to an allowlist is the durable one and is filed, not done, so
    // that a privacy change and a refactor do not ship in the same commit.
    ownIncome: "",
    managedBudget: "",
    displayName: "",
    householdName: "",
    city: "",
    subBudgets: {},
    // Guard: a corrupt/stale in-flight draft can carry a non-array `fixed`; pass it through
    // untouched so redaction never throws (loadDraft's coerceDraftState repairs it on read).
    fixed: Array.isArray(state.fixed) ? state.fixed.map((f) => ({ ...f, amount: "" })) : state.fixed,
  };
}

export function saveDraft(userId: string, state: WizardState, now: number): void {
  if (typeof window === "undefined") return;
  try {
    const env: DraftEnvelope = { savedAt: now, userId, state: redactDraftForStorage(state) };
    window.localStorage.setItem(draftKey(userId), JSON.stringify(env));
  } catch {
    /* quota / unavailable — drafts are best-effort */
  }
}

// ── Defensive draft coercion ─────────────────────────────────────────────────────
// A corrupt, hand-edited (devtools), or stale-schema draft must NEVER crash the wizard
// — computeTotals/steps do state.fixed.reduce(…), Object.values(state.subBudgets), and
// state.alerts[…]. We START from a valid default and overlay ONLY fields that pass a
// type/enum guard, so missing fields get defaults and wrong-typed fields are dropped.
// Returns null only when the payload is not an object at all (the caller then clears the key).
const PROFILE_TYPES: ReadonlyArray<HouseholdProfileType> = ["single", "couple", "family", "roomies"];
const BUDGET_BASES: ReadonlyArray<BudgetBasis> = ["calendar", "salary"];
const BUDGET_MODES: ReadonlyArray<BudgetMode> = ["income", "budget"];
const BASELINE_MODES: ReadonlyArray<FinancialBaselineMode> = ["quick", "precise"];
const REPORT_CAT_IDS: ReadonlyArray<ReportCatId> = REPORT_CATEGORIES.map((c) => c.id);
const SUB_BUDGET_CAT_IDS: ReadonlyArray<SubBudgetCatId> = SUB_BUDGET_CATS.map((c) => c.id);
const FREQUENCY_IDS: ReadonlyArray<FrequencyId> = FREQUENCIES.map((f) => f.id);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function inEnum<T extends string>(v: unknown, allowed: ReadonlyArray<T>): v is T {
  return typeof v === "string" && (allowed as ReadonlyArray<string>).includes(v);
}
function numberOrEmpty(v: unknown): number | "" {
  return typeof v === "number" && Number.isFinite(v) ? v : "";
}
function finiteNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function coerceFixedExpense(raw: unknown): WizardFixedExpense | null {
  if (!isPlainObject(raw)) return null;
  return {
    key: typeof raw.key === "string" ? raw.key
      : typeof raw.sourcePresetId === "string" ? raw.sourcePresetId
      : `f_${Math.random().toString(36).slice(2)}`,
    sourcePresetId: typeof raw.sourcePresetId === "string" ? raw.sourcePresetId : null,
    isCustom: raw.isCustom === true,
    on: raw.on !== false,
    label: typeof raw.label === "string" ? raw.label : "",
    reportCat: inEnum(raw.reportCat, REPORT_CAT_IDS) ? raw.reportCat : "misc",
    emoji: typeof raw.emoji === "string" ? raw.emoji : "💸",
    amount: numberOrEmpty(raw.amount),
    frequency: inEnum(raw.frequency, FREQUENCY_IDS) ? raw.frequency : "monthly",
    isEstimate: raw.isEstimate === true,
    alertOnChange: raw.alertOnChange === true,
    billingDay: typeof raw.billingDay === "number" && Number.isFinite(raw.billingDay) ? raw.billingDay : null
  };
}

/** Coerce an untrusted, possibly-corrupt loaded draft into a guaranteed-safe WizardState
 *  by overlaying validated fields onto a fresh default. Returns null only for a non-object. */
export function coerceDraftState(raw: unknown): WizardState | null {
  if (!isPlainObject(raw)) return null;
  const s = createDefaultState();
  if (inEnum(raw.mode, BASELINE_MODES)) s.mode = raw.mode;
  if (inEnum(raw.householdType, PROFILE_TYPES)) s.householdType = raw.householdType;
  s.adults = finiteNumber(raw.adults, s.adults);
  s.kids = finiteNumber(raw.kids, s.kids);
  if (Array.isArray(raw.kidAges)) s.kidAges = raw.kidAges.filter((a): a is KidAgeBracket => inEnum(a, KID_AGE_BRACKETS));
  if (typeof raw.displayName === "string") s.displayName = raw.displayName;
  if (typeof raw.householdName === "string") s.householdName = raw.householdName;
  if (typeof raw.city === "string") s.city = raw.city;
  s.cars = finiteNumber(raw.cars, s.cars);
  if (typeof raw.separateAccounts === "boolean") s.separateAccounts = raw.separateAccounts;
  const restoredShare = numberOrEmpty(raw.separateSharePct);
  if (restoredShare !== "" && restoredShare >= 0 && restoredShare <= 100) s.separateSharePct = restoredShare;
  // Consent is no longer a wizard field — a stale draft must not re-introduce a false consent and
  // re-block the profile step (the seeded `true` default always wins). See createDefaultState.
  if (inEnum(raw.basis, BUDGET_BASES)) s.basis = raw.basis;
  s.startDay = finiteNumber(raw.startDay, s.startDay);
  s.salaryDay = finiteNumber(raw.salaryDay, s.salaryDay);
  s.creditDay = finiteNumber(raw.creditDay, s.creditDay);
  s.incomeCount = finiteNumber(raw.incomeCount, s.incomeCount);
  if (inEnum(raw.budgetMode, BUDGET_MODES)) s.budgetMode = raw.budgetMode;
  s.income = numberOrEmpty(raw.income);
  // Carried because `redactDraftForStorage` spreads the whole state, so this flag really does
  // reach `localStorage` and a silently dropped `true` is how a stored income gets destroyed.
  // ⚠️ The first cut of this comment claimed the value "can only ever be `false`" on the grounds
  // that drafts are first-run only. `R-1` was right that the reason was wrong even where the line
  // was harmless: the refusal branch in `useOnboardingWizard` sets it, and stating a safety case
  // that does not hold is how the next reader deletes the line.
  if (typeof raw.incomeRedacted === "boolean") s.incomeRedacted = raw.incomeRedacted;
  s.managedBudget = numberOrEmpty(raw.managedBudget);
  if (typeof raw.managedTouched === "boolean") s.managedTouched = raw.managedTouched;
  if (Array.isArray(raw.fixed)) {
    s.fixed = raw.fixed.map(coerceFixedExpense).filter((f): f is WizardFixedExpense => f !== null);
  }
  if (isPlainObject(raw.subBudgets)) {
    const sb: Partial<Record<SubBudgetCatId, number>> = {};
    for (const id of SUB_BUDGET_CAT_IDS) {
      const v = raw.subBudgets[id];
      if (typeof v === "number" && Number.isFinite(v)) sb[id] = v;
    }
    s.subBudgets = sb;
  }
  if (isPlainObject(raw.alerts)) {
    const a: BaselineAlerts = { ...DEFAULT_ALERTS };
    for (const k of Object.keys(DEFAULT_ALERTS) as Array<keyof BaselineAlerts>) {
      const v = raw.alerts[k];
      if (typeof v === "boolean") a[k] = v;
    }
    s.alerts = a;
  }
  return s;
}

// ── Edit mode: reverse-map a persisted baseline → wizard state ───────────────────
// For "late onboarding / edit onboarding": an owner/admin re-enters the wizard at
// /onboarding?mode=edit to correct or complete their household baseline. We rebuild
// the wizard state from the persisted `financial_baseline` (+ household fallbacks for
// a pre-baseline household), so every field is pre-populated. Pure + defensive: it
// starts from a valid default and overlays ONLY present, type-valid fields — a
// missing/partial/legacy baseline degrades gracefully to the household fallbacks and
// defaults rather than crashing the wizard. The submit path is unchanged (the backend
// `completeOnboarding` UPSERTs the existing household in place — no duplicate).
export interface BaselineEditSource {
  /** The persisted baseline (NULL/undefined for a pre-baseline household → fallbacks used). */
  financialBaseline?: FinancialBaseline | null;
  /** Household-level fallbacks (used when the baseline is absent or partial). */
  name?: string;
  monthlyBudgetAmount?: number;
  defaultCity?: string | null;
  budgetCycleDay?: number;
}

function fixedFromBaseline(raw: unknown): WizardFixedExpense | null {
  if (!isPlainObject(raw)) return null;
  const sourcePresetId = typeof raw.sourcePresetId === "string" ? raw.sourcePresetId : null;
  const preset = sourcePresetId ? FIXED_PRESETS.find((p) => p.id === sourcePresetId) : undefined;
  return {
    // The wizard list key: prefer the server uuid, then the preset id, then a fresh local key.
    key: typeof raw.id === "string" && raw.id ? raw.id : sourcePresetId ?? `f_${Math.random().toString(36).slice(2)}`,
    // SEPACCT stage 1 / `OD-5`: the server's own id, kept separately from the list key so that
    // only a line the SERVER has already named can send one back. See `WizardFixedExpense`.
    ...(typeof raw.id === "string" && raw.id ? { serverId: raw.id } : {}),
    sourcePresetId,
    isCustom: raw.isCustom === true,
    // Baseline persists `isActive` (the wizard toggle is `on`). Default to on when absent.
    on: raw.isActive !== false,
    label: typeof raw.label === "string" ? raw.label : preset?.label ?? "",
    reportCat: inEnum(raw.reportCat, REPORT_CAT_IDS) ? raw.reportCat : preset?.reportCat ?? "misc",
    // Emoji is display-only and never persisted — recover it from the preset, else a generic glyph.
    emoji: preset?.emoji ?? "💸",
    amount: numberOrEmpty(raw.amount),
    frequency: inEnum(raw.frequency, FREQUENCY_IDS) ? raw.frequency : preset?.frequency ?? "monthly",
    isEstimate: raw.isEstimate === true,
    alertOnChange: raw.alertOnChange === true,
    billingDay: typeof raw.billingDay === "number" && Number.isFinite(raw.billingDay) ? raw.billingDay : null
  };
}

/** Build a guaranteed-safe WizardState for edit mode from the persisted baseline plus
 *  household fallbacks. Overlays only validated fields onto a fresh default. */
export function buildStateFromBaseline(source: BaselineEditSource | undefined, displayName?: string): WizardState {
  const s = createDefaultState();
  if (typeof displayName === "string" && displayName) s.displayName = displayName;
  if (!source) return s;
  // Household-level fallbacks first (a pre-baseline household has only these).
  if (typeof source.name === "string" && source.name) s.householdName = source.name;
  if (typeof source.defaultCity === "string" && source.defaultCity) s.city = source.defaultCity;
  if (typeof source.monthlyBudgetAmount === "number" && Number.isFinite(source.monthlyBudgetAmount)) {
    s.managedBudget = source.monthlyBudgetAmount;
    s.managedTouched = true;
  }
  if (typeof source.budgetCycleDay === "number" && Number.isFinite(source.budgetCycleDay)) {
    s.startDay = source.budgetCycleDay;
    s.salaryDay = source.budgetCycleDay;
  }
  const b = source.financialBaseline;
  if (!isPlainObject(b)) return s;
  if (inEnum(b.mode, BASELINE_MODES)) s.mode = b.mode;
  if (isPlainObject(b.profile)) {
    const p = b.profile;
    if (inEnum(p.type, PROFILE_TYPES)) s.householdType = p.type;
    s.adults = finiteNumber(p.adults, s.adults);
    s.kids = finiteNumber(p.kids, s.kids);
    if (Array.isArray(p.kidAges)) s.kidAges = p.kidAges.filter((a): a is KidAgeBracket => inEnum(a, KID_AGE_BRACKETS));
    if (typeof p.region === "string" && p.region) s.city = p.region;
    s.cars = finiteNumber(p.cars, s.cars);
    if (typeof p.separateAccounts === "boolean") s.separateAccounts = p.separateAccounts;
  }
  if (isPlainObject(b.cycle)) {
    const c = b.cycle;
    if (inEnum(c.basis, BUDGET_BASES)) s.basis = c.basis;
    s.startDay = finiteNumber(c.startDay, s.startDay);
    s.salaryDay = finiteNumber(c.salaryDay, s.salaryDay);
    s.creditDay = finiteNumber(c.creditDay, s.creditDay);
    s.incomeCount = finiteNumber(c.incomeCount, s.incomeCount);
  }
  if (isPlainObject(b.budget)) {
    const bg = b.budget;
    if (inEnum(bg.mode, BUDGET_MODES)) s.budgetMode = bg.mode;
    s.income = numberOrEmpty(bg.income);
    // §A56: the server hid the figure rather than the household emptying it. Carried so the save
    // does not rebuild a `0` over it, and so the step can say so instead of pretending to accept.
    if (bg.incomeRedacted === true) s.incomeRedacted = true;
    if (typeof bg.managedMonthlyBudget === "number" && Number.isFinite(bg.managedMonthlyBudget)) {
      s.managedBudget = bg.managedMonthlyBudget;
      s.managedTouched = true;
    }
  }
  if (Array.isArray(b.fixedExpenses)) {
    s.fixed = b.fixedExpenses.map(fixedFromBaseline).filter((f): f is WizardFixedExpense => f !== null);
  }
  if (isPlainObject(b.subBudgets)) {
    const sb: Partial<Record<SubBudgetCatId, number>> = {};
    for (const id of SUB_BUDGET_CAT_IDS) {
      const v = b.subBudgets[id];
      if (typeof v === "number" && Number.isFinite(v)) sb[id] = v;
    }
    s.subBudgets = sb;
  }
  if (isPlainObject(b.alerts)) {
    const a: BaselineAlerts = { ...DEFAULT_ALERTS };
    for (const k of Object.keys(DEFAULT_ALERTS) as Array<keyof BaselineAlerts>) {
      const v = b.alerts[k];
      if (typeof v === "boolean") a[k] = v;
    }
    s.alerts = a;
  }
  return s;
}

export function loadDraft(userId: string, now: number): WizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope;
    if (!env || env.userId !== userId || typeof env.savedAt !== "number") {
      window.localStorage.removeItem(draftKey(userId));
      return null;
    }
    if (now - env.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(draftKey(userId));
      return null;
    }
    // Structurally validate the stored state (not just the envelope): a corrupt or
    // stale-schema payload is repaired onto defaults; a non-object is rejected + purged.
    const safe = coerceDraftState(env.state);
    if (!safe) {
      window.localStorage.removeItem(draftKey(userId));
      return null;
    }
    return safe;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(userId));
  } catch {
    /* ignore */
  }
}

// ── Human-facing error copy for the onboarding submit (Hebrew-only) ──────────────
// Maps a known API error code to a short Hebrew message. A raw server message (English,
// or a Zod/JSON blob) must NEVER reach the UI — anything unrecognized falls back to a
// generic Hebrew sentence. Reads `code` defensively so any thrown value is safe input.
export function humanizeOnboardingError(err: unknown): string {
  const code = isPlainObject(err) && typeof err.code === "string" ? err.code : undefined;
  switch (code) {
    case "validation.invalid":
      return "חלק מהפרטים לא תקינים. בדקו את הסכומים והפרטים, ונסו שוב.";
    case "auth.csrf_invalid":
    case "auth.unauthorized":
    case "auth.forbidden":
      return "פג תוקף החיבור. רעננו את העמוד והתחברו שוב.";
    case "http.body_too_large":
      return "יש יותר מדי פרטים. נסו להסיר כמה הוצאות קבועות ולסיים שוב.";
    default:
      return "לא הצלחנו לסיים את ההגדרה. נסו שוב.";
  }
}
