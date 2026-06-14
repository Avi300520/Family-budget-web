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
    acceptTerms: false,
    acceptPrivacy: false,
    basis: "calendar",
    startDay: 1,
    salaryDay: 10,
    creditDay: 10,
    incomeCount: 1,
    budgetMode: "income",
    income: "",
    managedBudget: "",
    managedTouched: false,
    fixed: [],
    subBudgets: {},
    alerts: { ...DEFAULT_ALERTS }
  };
}

// ── Derived numbers ─────────────────────────────────────────────────────────────
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
export type StepKey = "welcome" | "profile" | "cycle" | "income" | "fixed" | "budget" | "alerts" | "done";

export const STEP_ORDER: ReadonlyArray<StepKey> = [
  "welcome", "profile", "cycle", "income", "fixed", "budget", "alerts", "done"
];

/** Returns null when the step is valid, or a Hebrew error message when it is not. */
export function validateStep(step: StepKey, state: WizardState): string | null {
  switch (step) {
    case "profile":
      if (!state.displayName.trim()) return "כתבו את השם שלכם.";
      if (!state.householdName.trim()) return "כתבו שם לבית.";
      if (!state.city.trim()) return "כתבו עיר או אזור.";
      if (state.adults < 1) return "צריך לפחות מבוגר אחד.";
      if (!state.acceptTerms || !state.acceptPrivacy) return "צריך לאשר את התנאים ואת מדיניות הפרטיות.";
      return null;
    case "income":
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
      income: state.budgetMode === "income" ? num(state.income) : null,
      managedMonthlyBudget: managed
    },
    fixedExpenses: state.fixed
      .filter((f) => f.on)
      .map((f) => ({
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

// ── localStorage draft (user-scoped, TTL, no PII/secrets beyond typed fields) ────
const DRAFT_PREFIX = "pingtally_onb_draft_v1";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function draftKey(userId: string): string {
  return `${DRAFT_PREFIX}:${userId}`;
}

interface DraftEnvelope {
  savedAt: number;
  userId: string;
  state: WizardState;
}

export function saveDraft(userId: string, state: WizardState, now: number): void {
  if (typeof window === "undefined") return;
  try {
    const env: DraftEnvelope = { savedAt: now, userId, state };
    window.localStorage.setItem(draftKey(userId), JSON.stringify(env));
  } catch {
    /* quota / unavailable — drafts are best-effort */
  }
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
    return env.state ?? null;
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
