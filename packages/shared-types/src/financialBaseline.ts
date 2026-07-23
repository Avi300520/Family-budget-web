/**
 * Household Financial Baseline — the rich onboarding model captured by the
 * "Household Financial Baseline Builder" wizard and persisted (V1) inside the
 * single nullable `households.financial_baseline jsonb` column.
 *
 * Design rules (see the approved onboarding-redesign plan):
 *  - `monthly_budget_amount` stays the MANAGED budget (never raw income). Income,
 *    when provided, lives only in `budget.income` here.
 *  - The 12 `reportCat` values are the display/grouping truth and are PRESERVED
 *    verbatim on every fixed expense. The lossy projection to the 7 canonical
 *    purchase categories (`REPORT_CAT_TO_PURCHASE`) is used ONLY where existing
 *    budget math needs a 7-category (i.e. `category_budgets`) — never for NLP.
 *  - Monthly normalization is derived in code (`monthlyOf`), never persisted as a
 *    derived column, so it can never drift from amount/frequency.
 *
 * This file holds only types + pure constants/helpers (mirrors
 * `shoppingCategories.ts`). The wizard, validation, and the dual store all import
 * from here so FE preview, BE budget math, and any future NLP agree on one source.
 */

/** The 7 canonical purchase categories (mirrors `Purchase["category"]`). Declared
 *  here too so this module stays free of a circular import on `index.ts`. */
export type PurchaseCategory =
  | "supermarket"
  | "pharmacy_health"
  | "restaurants_cafes"
  | "fuel_transport"
  | "kids"
  | "entertainment"
  | "other";

// ── Report categories (the 12 display categories) ──────────────────────────────

export type ReportCatId =
  | "groceries"
  | "eating"
  | "clothing"
  | "kids"
  | "transport"
  | "home"
  | "health"
  | "subscriptions"
  | "debt"
  | "saving"
  | "fun"
  | "misc";

export interface ReportCatMeta {
  id: ReportCatId;
  /** Hebrew display label. */
  labelHe: string;
  icon: string;
}

/** The closed canonical list used by BOTH preset and custom fixed expenses. */
export const REPORT_CATEGORIES: ReadonlyArray<ReportCatMeta> = [
  { id: "groceries",     labelHe: "סופר ומזון",   icon: "🛒" },
  { id: "eating",        labelHe: "אוכל בחוץ",     icon: "🍕" },
  { id: "clothing",      labelHe: "ביגוד",         icon: "👕" },
  { id: "kids",          labelHe: "ילדים",         icon: "🎨" },
  { id: "transport",     labelHe: "תחבורה",        icon: "⛽" },
  { id: "home",          labelHe: "בית וחשבונות",  icon: "🏠" },
  { id: "health",        labelHe: "בריאות",        icon: "💊" },
  { id: "subscriptions", labelHe: "מנויים",        icon: "📺" },
  { id: "debt",          labelHe: "הלוואות",       icon: "🏦" },
  { id: "saving",        labelHe: "חיסכון",        icon: "🐷" },
  { id: "fun",           labelHe: "בילויים",       icon: "🎬" },
  { id: "misc",          labelHe: "שונות",         icon: "✨" },
];

export const REPORT_CAT_IDS: ReadonlyArray<ReportCatId> = REPORT_CATEGORIES.map((c) => c.id);

export function isReportCatId(value: unknown): value is ReportCatId {
  return typeof value === "string" && REPORT_CAT_IDS.includes(value as ReportCatId);
}

/**
 * Lossy projection of the 12 report categories onto the 7 canonical purchase
 * categories. Used ONLY where existing budget math requires a 7-category
 * (`category_budgets`). The precise `reportCat` is always retained in the
 * baseline; never use this map for NLP/classification decisions in V1.
 *
 * `subscriptions → other` (NOT entertainment — that was a known mis-bin).
 */
export const REPORT_CAT_TO_PURCHASE: Record<ReportCatId, PurchaseCategory> = {
  groceries: "supermarket",
  eating: "restaurants_cafes",
  transport: "fuel_transport",
  kids: "kids",
  health: "pharmacy_health",
  fun: "entertainment",
  subscriptions: "other",
  clothing: "other",
  home: "other",
  debt: "other",
  saving: "other",
  misc: "other",
};

export function mapReportCat(id: ReportCatId): PurchaseCategory {
  return REPORT_CAT_TO_PURCHASE[id] ?? "other";
}

/** Report categories that are NOT spend (transfers/savings/debt repayment). A
 *  future budget aggregation should exclude these so they never inflate spend. */
export const NON_SPEND_REPORT_CATS: ReadonlySet<ReportCatId> = new Set<ReportCatId>(["debt", "saving"]);

// ── Sub-budget categories (the 8 variable-budget buckets) ──────────────────────

/** Sub-budget bucket ids — a subset of the report categories. */
export type SubBudgetCatId =
  | "groceries"
  | "eating"
  | "clothing"
  | "kids"
  | "transport"
  | "home"
  | "fun"
  | "misc";

export interface SubBudgetCatMeta {
  id: SubBudgetCatId;
  labelHe: string;
  icon: string;
  /** Suggested share of the available pool used by the wizard auto-split. */
  weight: number;
}

export const SUB_BUDGET_CATEGORIES: ReadonlyArray<SubBudgetCatMeta> = [
  { id: "groceries", labelHe: "קניות שוטפות וסופר", icon: "🛒", weight: 0.34 },
  { id: "eating",    labelHe: "מסעדות וקפה",        icon: "🍕", weight: 0.12 },
  { id: "clothing",  labelHe: "ביגוד",              icon: "👕", weight: 0.07 },
  { id: "kids",      labelHe: "ילדים",              icon: "🎨", weight: 0.12 },
  { id: "transport", labelHe: "תחבורה ודלק",        icon: "⛽", weight: 0.13 },
  { id: "home",      labelHe: "בית ותחזוקה",        icon: "🔧", weight: 0.08 },
  { id: "fun",       labelHe: "בילויים",            icon: "🎬", weight: 0.09 },
  { id: "misc",      labelHe: "שונות",              icon: "✨", weight: 0.05 },
];

export const SUB_BUDGET_CAT_IDS: ReadonlyArray<SubBudgetCatId> = SUB_BUDGET_CATEGORIES.map((c) => c.id);

/**
 * Clean-maps-only projection of sub-budget buckets → purchase categories.
 * ONLY the unambiguous buckets are listed; the ambiguous ones (`clothing`,
 * `home`, `misc`) collapse to `other` and are intentionally OMITTED so the
 * onboarding flow never writes lossy/colliding `(household, 'other')` caps. They
 * stay in the JSONB baseline only. (V1 decision — do NOT sum into `other`.)
 */
export const SUB_BUDGET_CLEAN_MAP: Partial<Record<SubBudgetCatId, PurchaseCategory>> = {
  groceries: "supermarket",
  eating: "restaurants_cafes",
  kids: "kids",
  transport: "fuel_transport",
  fun: "entertainment",
};

// ── Frequencies + monthly normalization ────────────────────────────────────────

export type FrequencyId = "weekly" | "monthly" | "bimonthly" | "quarterly" | "yearly";

export interface FrequencyMeta {
  id: FrequencyId;
  labelHe: string;
  /** Multiplier to normalize a per-occurrence amount to a monthly amount. */
  monthlyFactor: number;
}

export const FREQUENCIES: ReadonlyArray<FrequencyMeta> = [
  { id: "weekly",    labelHe: "שבועי",    monthlyFactor: 52 / 12 },
  { id: "monthly",   labelHe: "חודשי",    monthlyFactor: 1 },
  { id: "bimonthly", labelHe: "דו-חודשי", monthlyFactor: 1 / 2 },
  { id: "quarterly", labelHe: "רבעוני",   monthlyFactor: 1 / 3 },
  { id: "yearly",    labelHe: "שנתי",     monthlyFactor: 1 / 12 },
];

export const MONTHLY_FACTOR: Record<FrequencyId, number> = {
  weekly: 52 / 12,
  monthly: 1,
  bimonthly: 1 / 2,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function isFrequencyId(value: unknown): value is FrequencyId {
  return typeof value === "string" && value in MONTHLY_FACTOR;
}

/** Monthly-normalized amount for a recurring expense, rounded to whole ILS.
 *  Single source of truth shared by FE preview and BE budget math. */
export function monthlyOf(amount: number, frequency: FrequencyId): number {
  const factor = MONTHLY_FACTOR[frequency] ?? 1;
  const value = (Number(amount) || 0) * factor;
  return Math.round(value);
}

// ── The persisted baseline shape ────────────────────────────────────────────────

export type FinancialBaselineMode = "quick" | "precise";
export type HouseholdProfileType = "single" | "couple" | "family" | "roomies";
export type BudgetBasis = "calendar" | "salary";
export type BudgetMode = "income" | "budget";

/** Kid age-bracket ids (multi-select chips). */
export type KidAgeBracket = "0-3" | "4-6" | "7-12" | "13-18";
export const KID_AGE_BRACKETS: ReadonlyArray<KidAgeBracket> = ["0-3", "4-6", "7-12", "13-18"];

export interface BaselineProfile {
  type: HouseholdProfileType;
  adults: number;
  kids: number;
  /** Age-bracket ids; only meaningful when kids > 0. */
  kidAges: KidAgeBracket[];
  region?: string;
  cars: number;
}

export interface BaselineCycle {
  basis: BudgetBasis;
  /** Day-of-month the cycle renews (calendar basis). */
  startDay?: number;
  /** Salary day (salary basis). */
  salaryDay?: number;
  /** Credit-card billing day (precise mode only). */
  creditDay?: number;
  /** Number of income sources (precise mode only). */
  incomeCount: number;
}

export interface BaselineBudget {
  mode: BudgetMode;
  /** Income-mode only; OPTIONAL; baseline-only — NEVER written to monthly_budget_amount. */
  income?: number | null;
  /** The user-confirmed MANAGED monthly budget. Mirrors household.monthlyBudgetAmount. */
  managedMonthlyBudget: number;
}

export interface BaselineFixedExpense {
  /** Server-assigned uuid (stable per household instance). */
  id: string;
  /** Preset key when derived from a preset; null/undefined for custom items. */
  sourcePresetId?: string | null;
  isCustom: boolean;
  label: string;
  /** Precise 12-category — preserved verbatim. */
  reportCat: ReportCatId;
  amount: number;
  frequency: FrequencyId;
  isEstimate: boolean;
  alertOnChange: boolean;
  billingDay?: number | null;
  isActive: boolean;
}

export interface BaselineAlerts {
  cat80: boolean;
  cat100: boolean;
  billUp: boolean;
  unusual: boolean;
  monthly: boolean;
  weekly: boolean;
}

/** The full persisted baseline. `version` lets a future edit surface migrate the
 *  blob in code without a DB migration. Stored at `households.financial_baseline`;
 *  NULL in the DB round-trips to `undefined` on the Household DTO. */
export interface FinancialBaseline {
  version: number;
  mode: FinancialBaselineMode;
  profile?: BaselineProfile;
  cycle?: BaselineCycle;
  budget?: BaselineBudget;
  fixedExpenses: BaselineFixedExpense[];
  /** Keyed by SubBudgetCatId → monthly amount in ILS. */
  subBudgets: Partial<Record<SubBudgetCatId, number>>;
  alerts?: BaselineAlerts;
}

export const FINANCIAL_BASELINE_VERSION = 1;

/** Wire shape POSTed by the onboarding wizard. Mirrors `FinancialBaseline` except
 *  custom fixed expenses carry no server `id` (the server assigns a uuid on
 *  persist). Used by the api-client request type and the FE wizard state. */
export interface OnboardingBaselineRequest {
  version?: number;
  mode?: FinancialBaselineMode;
  profile?: BaselineProfile;
  cycle?: BaselineCycle;
  budget?: BaselineBudget;
  fixedExpenses?: Array<Omit<BaselineFixedExpense, "id"> & { id?: string }>;
  subBudgets?: Partial<Record<SubBudgetCatId, number>>;
  alerts?: BaselineAlerts;
}

/** Sum of monthly-normalized active fixed expenses. */
export function totalMonthlyFixed(items: ReadonlyArray<BaselineFixedExpense>): number {
  return items.reduce((sum, it) => (it.isActive ? sum + monthlyOf(it.amount, it.frequency) : sum), 0);
}
