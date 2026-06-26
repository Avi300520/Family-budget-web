/**
 * Canonical Hebrew labels for purchase categories — shared across all web pages.
 * Must stay in sync with the CATEGORY_HE constants in:
 *   apps/api/src/nlp/handlers.ts
 *   apps/api/src/server.ts
 *   apps/api/src/messages.ts
 */
export const CATEGORY_LABELS: Record<string, string> = {
  supermarket:       "קניות לבית",
  pharmacy_health:   "פארם ובריאות",
  restaurants_cafes: "מסעדות וקפה",
  fuel_transport:    "דלק ותחבורה",
  kids:              "ילדים",
  entertainment:     "בילוי",
  other:             "אחר",
  // Legacy values kept for backward compatibility (old purchases in DB)
  minimarket:        "מכולת",
  produce:           "ירקות ופירות",
  pharmacy:          "פארם ובריאות",
  household:         "ציוד בית"
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ── The 14 display budget categories (the design handoff's "canonical 14") ──────
// Source: design_handoff_pingtally_app/.../settings/src/set-data.js `categoryBudgets`.
// Presentation layer ONLY — each row rolls up to exactly one of the 7 backend
// Purchase buckets (`bucket`). `capable` rows own a UNIQUE bucket and carry a real,
// editable backend cap (PUT/DELETE /category-budgets/:bucket). The rest roll into
// `other` and are shown for tracking only — there is no separate cap until the
// backend enum grows (deliberate: keeps the 7-enum spine, zero migration).
// Labels for `capable` rows must stay equal to CATEGORY_LABELS[bucket] above.
export type PurchaseBucket =
  | "supermarket"
  | "pharmacy_health"
  | "restaurants_cafes"
  | "fuel_transport"
  | "kids"
  | "entertainment"
  | "other";

export interface BudgetCategoryMeta {
  id: string;
  labelHe: string;
  icon: string;
  /** CSS color token (e.g. "var(--teal)") for the icon-tile tint. */
  color: string;
  bucket: PurchaseBucket;
  /** true → editable backend cap on `bucket`; false → display/tracking row. */
  capable: boolean;
}

export const BUDGET_CATEGORIES: ReadonlyArray<BudgetCategoryMeta> = [
  { id: "groceries", labelHe: "קניות לבית",     icon: "🛒", color: "var(--teal)",    bucket: "supermarket",       capable: true },
  { id: "pharm",     labelHe: "פארם ובריאות",   icon: "💊", color: "var(--sage)",    bucket: "pharmacy_health",   capable: true },
  { id: "eating",    labelHe: "מסעדות וקפה",     icon: "🍕", color: "var(--coral)",   bucket: "restaurants_cafes", capable: true },
  { id: "transport", labelHe: "דלק ותחבורה",    icon: "⛽", color: "var(--ocean)",   bucket: "fuel_transport",    capable: true },
  { id: "kids",      labelHe: "ילדים",           icon: "🎨", color: "var(--mustard)", bucket: "kids",              capable: true },
  { id: "fun",       labelHe: "בילוי",           icon: "🎬", color: "var(--plum)",    bucket: "entertainment",     capable: true },
  { id: "clothing",  labelHe: "ביגוד",           icon: "👕", color: "var(--berry)",   bucket: "other",             capable: false },
  { id: "home",      labelHe: "בית וחשבונות",    icon: "🏠", color: "var(--ocean)",   bucket: "other",             capable: false },
  { id: "subs",      labelHe: "מנויים",          icon: "📺", color: "var(--plum)",    bucket: "other",             capable: false },
  { id: "health",    labelHe: "בריאות",          icon: "⚕️", color: "var(--sage)",    bucket: "other",             capable: false },
  { id: "education", labelHe: "חינוך וחוגים",    icon: "🎒", color: "var(--mustard)", bucket: "other",             capable: false },
  { id: "gifts",     labelHe: "מתנות ואירועים",  icon: "🎁", color: "var(--coral)",   bucket: "other",             capable: false },
  { id: "savings",   labelHe: "חיסכון",          icon: "🐷", color: "var(--teal)",    bucket: "other",             capable: false },
  { id: "extra",     labelHe: "אחר",             icon: "✨", color: "var(--text-2)",  bucket: "other",             capable: false },
];

/** The unique buckets that carry a real, editable backend cap (the 6 cap-able rows). */
export const CAP_BUCKETS: ReadonlyArray<PurchaseBucket> = BUDGET_CATEGORIES.filter((c) => c.capable).map(
  (c) => c.bucket
);
