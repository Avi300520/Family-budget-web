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
/**
 * **A4 slice B — the four household types as a RUNTIME list.**
 *
 * `HouseholdProfileType` is a type and is erased at runtime, so nothing could enumerate the
 * domain without hand-writing it again. This mirrors `KID_AGE_BRACKETS` directly above and
 * `PURCHASE_CATEGORIES` in `packages/db`: a value that must stay in lockstep with the type.
 *
 * ⚠️ THE DOMAIN IS DECLARED IN THREE PLACES AND CANNOT BE UNIFIED. `packages/validation`
 * depends on **zod alone** (its `package.json` lists no workspace dependency at all), so this
 * constant cannot reach the Zod enums, and `packages/db` does not depend on `validation`, so
 * the Zod enums cannot reach the stores. The three are therefore kept in agreement by an
 * ASSERTION rather than by construction: `apps/api/src/hh-a4-typewrite.gate.test.ts` compares
 * this constant, `updateHouseholdTypeSchema`'s enum and
 * `financialBaselineRequestSchema.profile.type`'s enum, and reds on any drift.
 *
 * ⚠️ `pnpm sync:shared` is NOT run in this stage (`S-57` / OD-7 (a)) — see
 * `RELEASE_RUNBOOK.md`'s release-coupling entry. This addition is additive, so the frontend's
 * un-synced copy stays valid and its build stays green.
 */
export const HOUSEHOLD_PROFILE_TYPES: ReadonlyArray<HouseholdProfileType> = ["single", "couple", "family", "roomies"];

/**
 * **A9 piece 5d — the per-household DEFAULT EXPENSE SCOPE override (OD-9 (a), OD-10 (a)).**
 *
 * The two values `purchases.expense_type` may hold, and nothing else: A9 adds no third scope
 * anywhere, in any flag state, on any path. Declared as a runtime list for the same reason
 * `HOUSEHOLD_PROFILE_TYPES` above is — the type is erased at runtime, so nothing could
 * enumerate the domain without hand-writing it a second time, and a gate that hand-writes it
 * cannot fail on the value it omits.
 *
 * ⚠️ THE DOMAIN IS DECLARED IN TWO PLACES AND CANNOT BE UNIFIED, exactly as the type's is:
 * `packages/validation` depends on zod alone and cannot import this. The two copies are held
 * in agreement by an ASSERTION — `apps/api/src/hh-a9-scope-route.gate.test.ts` compares this
 * constant with `updateHouseholdDefaultExpenseScopeSchema`'s enum and reds on drift.
 */
export type HouseholdDefaultExpenseScope = "household" | "personal";
export const HOUSEHOLD_DEFAULT_EXPENSE_SCOPES: ReadonlyArray<HouseholdDefaultExpenseScope> = ["household", "personal"];
/**
 * **SEPACCT stage 1 (`SPLITKEY`) — one member's share of one shared expense, in BASIS POINTS.**
 *
 * `shareBp = 5000` is 50%. Integer basis points, never a percentage with decimals and never a
 * float: money arithmetic in this product is integer with formatting at the boundary, and a
 * `numeric(5,2)` would merely *usually* be right where an integer cannot be wrong.
 *
 * ⚠️ THIS IS A DEFAULT, NOT AN ALLOCATION. Stage 1 stores it and NOTHING reads it. The stored
 * per-expense allocation (`purchase_splits`) is stage 2's, and until it exists an expense has
 * ZERO split rows, which means "not allocated" and NOT "allocated to nobody" — every displayed
 * number stays byte-identical to today (`SEPACCT_SPEC` §3.4).
 *
 * ⚠️ THE SUM RULE BINDS THE ALLOCATION, NOT THIS TYPE. `MBT-8` requires the shares present on an
 * ALLOCATED expense to sum to exactly `SPLIT_BASIS_POINTS_TOTAL`; a stored DEFAULT is a
 * suggestion that a later write resolves, so it is not sum-checked here.
 */
export interface BaselineSplitShare {
  /** `users.id` of the member this share belongs to. */
  userId: string;
  /** Basis points, 0..10000. `0` is a positive statement that this member owes nothing. */
  shareBp: number;
}

/** Basis points in a whole. Declared as a value because the type system cannot enumerate it and
 *  a gate that hand-writes `10000` a second time cannot fail on the copy it omits. */
export const SPLIT_BASIS_POINTS_TOTAL = 10000;

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
  /**
   * **A4 slice C — Decision 5c's confirmation stamp (OD-4 (a), OD-7 (a)).** ISO instant at
   * which a household MANAGER last confirmed the type through
   * `PATCH /households/:id/household-type`. Server-set ONLY.
   *
   * ⚠️ OPTIONAL, AND ITS ABSENCE IS LOAD-BEARING. `type` alone is a SUGGESTION — onboarding
   * derives it from the composition question and nobody has ever confirmed it. Every live
   * baseline is recorded as unstamped. So while `HOUSEHOLD_TYPE_ENABLED` is armed, an
   * UNSTAMPED type does not reach the split-pot default at all: `resolveExpenseScope`
   * abstains to `household`. Without that, the moment
   * `HOUSEHOLD_SPLIT_POT_DEFAULT_ENABLED` arms, any household whose onboarding SUGGESTION
   * happened to be `roomies` starts booking expenses as `personal` with nobody having asked
   * for it — K8, violated silently.
   *
   * ⚠️ ABSENT, NEVER `null`. A `null` here would be indistinguishable from a stamp for any
   * `!== undefined` check and would defeat MUST-BE-TRUE #19, which is precisely the
   * absent-vs-present-and-undefined distinction. The write path adds the key only when it
   * sets it; `hh-a4-stamp.gate.test.ts` / `hh-a4-stamp-pg.gate.test.ts` assert absence with
   * `Object.prototype.hasOwnProperty` in both stores.
   *
   * ⚠️ ADDITIVE AND OPTIONAL so the frontend's UN-SYNCED copy of this file stays valid and
   * both Vercel builds stay green. `pnpm sync:shared` is NOT run in this stage (`S-57` /
   * OD-7 (a)); the sync and its paired frontend commit are a RELEASE-COUPLED step recorded
   * in `RELEASE_RUNBOOK.md`, discharged at deploy.
   */
  typeConfirmedAt?: string;
  /**
   * **A9 piece 5d — the household's EXPLICIT default expense scope (OD-9 (a), OD-10 (a)).**
   * Set only by `PATCH /households/:id/default-expense-scope`, by a household MANAGER.
   *
   * ⚠️ IT IS A DEFAULT, NEVER A RESTRICTION. No expense is refused, flagged or altered because
   * of it; it decides only what an UNTAGGED, unhinted expense books as, and only when
   * `HOUSEHOLD_SPLIT_POT_DEFAULT_ENABLED` is armed. It sits at RUNG 5 in `resolveExpenseScope`
   * and changes nothing above it — an explicit tag, an LLM hint, a flow-fixed scope and the
   * `limited_member` abstention (invariant #4) all still win.
   *
   * ⚠️ OD-10 (a): IT WINS OVER A4's UNCONFIRMED-TYPE INTERLOCK, because setting it IS the
   * deliberate manager action that interlock exists to require. It deliberately does NOT write
   * `typeConfirmedAt`: a manager who chooses a SCOPE default has said nothing about the
   * household's TYPE, and silently stamping one would confirm a suggestion nobody confirmed.
   *
   * ⚠️ ABSENT, NEVER `null` — the same discipline `typeConfirmedAt` carries. A `null` here is
   * indistinguishable from a value for any `!== undefined` check and defeats MUST-BE-TRUE #20,
   * which is precisely the absent-vs-present-and-undefined distinction. The write path adds the
   * key only when it sets it, and the gates assert absence with `Object.prototype.hasOwnProperty`
   * in BOTH stores.
   *
   * ⚠️ ADDITIVE AND OPTIONAL so the frontend's UN-SYNCED copy of this file stays valid and both
   * Vercel builds stay green. `pnpm sync:shared` is NOT run in this stage (`S-57`).
   */
  defaultExpenseScope?: HouseholdDefaultExpenseScope;
  /**
   * **SEPACCT stage 1 (`SPLITKEY`) — the household keeps SEPARATE ACCOUNTS (`OD-2` (a), `D-0007`).**
   *
   * Two partners run one household and keep their finances apart: the house spends, each partner
   * owes a share, nobody pays into anything (`SEPACCT_SPEC` §1). `true` is the household's own
   * answer to that question and nothing else — it is not a role, not a permission and not a type.
   *
   * ⚠️ A BOOLEAN HERE AND NOT A FIFTH `HouseholdProfileType`. `D-2026-08-14-21` rejected a fifth
   * type value because `defaultScopeForType`'s codomain is TWO values and a fifth would have to
   * pick one of them. A boolean beside the type touches that function not at all, which is why
   * `D-0007`'s 2026-08-25 amendment rules `OD-2` (a): rejecting a fifth type VALUE was never
   * rejecting a stored arrangement FIELD. Owner decisions #5a (four values unrenamed) and #5d
   * (no `household_type` column) are both honoured, simultaneously.
   *
   * ⚠️ ABSENT, NEVER `null` — the discipline `typeConfirmedAt` and `defaultExpenseScope` above
   * already carry. A `null` is indistinguishable from a value for any `!== undefined` check.
   *
   * ⚠️ STORED, READ BY NOTHING, and stripped entirely while `HOUSEHOLD_SEPARATE_ACCOUNTS_ENABLED`
   * is off (`normalizeFinancialBaseline`). That is what makes stage 1 safe for the live
   * households: with the flag off the persisted blob is byte-identical to today.
   */
  separateAccounts?: boolean;
  /**
   * **`AMENDMENT_10` §A39 — WHEN THIS HOUSEHOLD'S ARRANGEMENT BEGAN, and the origin of every
   * member's window.**
   *
   * ⚠️ SERVER-SET ONLY, EXACTLY LIKE `typeConfirmedAt`. `financialBaselineRequestSchema.profile`
   * does not declare this key and is a NON-STRICT `z.object`, so a client that sends one has it
   * silently stripped at the HTTP boundary. A caller must never be able to supply the instant its
   * own window opens at — that would be a client choosing which of its history counts.
   *
   * ⚠️ IT IS WRITTEN IN THE SAME SPREAD AS `separateAccounts`, so there is no shape of a
   * successful declaration that lands the answer without its date. `mergeHouseholdType` writes
   * `typeConfirmedAt` beside `type` for the identical reason and says so in the same words.
   *
   * ⚠️ ABSENT, NEVER `null` — the discipline the three fields above already carry. A `null` is
   * indistinguishable from a value for any `!== undefined` check.
   *
   * ⚠️ Stripped while `HOUSEHOLD_SEPARATE_ACCOUNTS_ENABLED` is off, and CARRIED across the
   * whole-document baseline overwrite while it is on — both in `carrySeparateAccounts`, beside the
   * two fields it already handles.
   */
  separateAccountsDeclaredAt?: string;
  /**
   * **SEPACCT stage 1 — the household's DEFAULT division of a shared expense (`SEPACCT_SPEC` §4.2).**
   *
   * Basis points per member, the household-wide fallback in the resolution ladder
   * `explicit per-expense split -> the fixed-expense line's own default -> profile.defaultSplit ->
   * none`. Half-and-half for two partners is the honest default and is the one-tap answer.
   *
   * ⚠️ IT IS PROSPECTIVE ONLY (`D-0010`). Editing this never moves a stored `purchase_splits` row
   * and never moves a past position. A month divided 60/40 stays 60/40 after the couple moves to
   * 50/50, permanently, and that is not drift — any screen or gate that recomputes a past share
   * from the CURRENT default rather than reading the stored row is a defect (`MBT-13`).
   *
   * ⚠️ A `limited_member` NEVER APPEARS HERE (`OD-10` (a)). A child's household expense goes
   * through the approval trail (invariant #4) and is never allocated.
   *
   * ⚠️ ABSENT, NEVER `null`; stored, read by nothing, stripped while the flag is off.
   */
  defaultSplit?: BaselineSplitShare[];
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
  /**
   * ── `AMENDMENT_15` §A56 — **THE REDACTION MARK. A PROPERTY OF A READ, CARRIED ON THE DOCUMENT.**
   *
   * `true` on a DTO whose `income` was removed by `stripSharedIncomeUnderSeparateAccounts`. It is
   * never stored: `carryOwnIncome` deletes it on the way in, and `normalizeFinancialBaseline`'s
   * output never carries it.
   *
   * 🔴 **IT EXISTS BECAUSE INFERRING THE REDACTION AT WRITE TIME IS A DIFFERENT PREDICATE, AND
   * `R-1` MEASURED THE DIFFERENCE.** The first cut of §A56 asked *is this household arranged NOW*
   * instead of *was the document I am being handed derived from a redacted read*. They agree only
   * while the arrangement does not change between the read and the write — so `declare → read →
   * un-declare → save` destroyed the income again, and the disarmed lever the same run added made
   * that sequence reachable with every flag off. §A56 said this in advance: *"the write path
   * refuses a document derived from a redacted read, by marking the field redacted rather than
   * absent."*
   *
   * ⚠️ IT IS A HINT, NOT AN AUTHORITY. A client that drops the key does not get a write it should
   * not have — the stored arrangement is still checked as well, and either condition refuses.
   *
   * 🔑 **`AMENDMENT_16` §A60 — IT IS ALSO THE CLIENT'S ONLY WAY TO KNOW THE FIELD IS UNWRITABLE,
   * AND IT IS THEREFORE PRESENT ON EVERY ARRANGED READ**, whether or not a figure was there to
   * hide. The write path refuses an incoming `income` for every arranged household; a read that
   * carried no mark left the wizard rendering an editable field whose value was dropped behind a
   * `200 OK`. The client reads this key to render the income step read-only, and to tell the person
   * — on the step where they tried — when a save it thought was writable came back redacted.
   */
  incomeRedacted?: boolean;
  /** The user-confirmed MANAGED monthly budget. Mirrors household.monthlyBudgetAmount. */
  managedMonthlyBudget: number;
}

export interface BaselineFixedExpense {
  /** Server-assigned uuid (stable per household instance). */
  /**
   * ⚠️ SEPACCT stage 1 / `OD-5`: "server-assigned" above still holds, and it was checked rather than
   * assumed. The wizard may now send an `id` back, but only one this server assigned - the client
   * carries it in a field populated solely from a persisted baseline, and a line the user has just
   * added sends no `id` key at all. The server remains the only minter: it accepts a supplied id
   * only when it is a syntactic uuid and is not already used by an earlier line in the same
   * payload, and mints a fresh one otherwise.
   */
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
  /** WP-P3 (TASK-17): the last amount observed for this recurring bill via a matched
   *  LOG_EXPENSE, and when (ISO). Server-set ONLY (never client-provided); absent until
   *  the first match. The price-change detector compares a new observation against
   *  `lastObservedAmount ?? amount`. Additive/optional so old JSONB rows round-trip fine. */
  lastObservedAmount?: number | null;
  lastObservedAt?: string | null;
  /**
   * **SEPACCT stage 1 — this recurring commitment's OWN default division (`SEPACCT_SPEC` §8.2).**
   *
   * A fixed expense is a commitment, not a transaction: it carries the DEFAULT split, and the
   * electricity bill somebody actually pays is a `purchases` row that carries the ACTUAL one.
   * Money only ever flows through purchases, so invariant #1 is untouched and no aggregate moves.
   * This is the rung above `profile.defaultSplit` and below an explicit per-expense split — it is
   * what lets arnona be half-and-half while one partner pays more of the kindergarten.
   *
   * ⚠️ IT MUST SURVIVE THE WHOLE-DOCUMENT BASELINE OVERWRITE, and that is `MBT-14`. The client
   * does not send this field, so `normalizeFinancialBaseline` CARRIES IT FORWARD from the stored
   * line — keyed on `sourcePresetId` where present and on `id` for a custom line
   * (`SEPACCT_SPEC` §8.3). The `lastObservedAmount` precedent directly above is the same shape
   * and the same reason: server-set data that a wizard edit must not erase.
   *
   * ⚠️ CUSTOM LINES ONLY BECAME KEYABLE WITH `OD-5`. Until this stage the client sent no `id`
   * AND `fixedExpenseInputSchema` deleted one if it arrived, so a custom line's uuid was
   * regenerated on every save. Both halves are closed by this stage; a preset line was always
   * stable because `sourcePresetId` is sent and preserved.
   *
   * ⚠️ A `limited_member` NEVER APPEARS HERE either (`OD-10` (a)) - this rung and
   * `profile.defaultSplit` are the two halves of one resolution ladder and the rule binds both.
   * ⚠️ **NOT ENFORCED AT THIS WRITE, and stated rather than left to be discovered.**
   * `normalizeFinancialBaseline` is a pure function with no store access, so it cannot resolve a
   * role; the request schema validates `userId` as a bare uuid and nothing checks membership.
   * It is inert here - stage 1 stores this and reads it nowhere, and with zero `purchase_splits`
   * rows every share is 0 - but the stage that RESOLVES a default into rows must refuse a
   * `limited_member`, and refusing it only at the route would be the N-1-of-N miss.
   *
   * ⚠️ Absent, never `null`; stripped while `HOUSEHOLD_SEPARATE_ACCOUNTS_ENABLED` is off.
   */
  defaultSplit?: BaselineSplitShare[];
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
