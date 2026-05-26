/**
 * Shopping route categories — 7 fixed categories that mirror the physical
 * order a customer walks through a typical Israeli supermarket.
 *
 * The order field is the "walking sequence" used by the Frontend RouteMap
 * and the WhatsApp message grouping. 1 = first station, 7 = last.
 *
 * This file holds only types and constants — the categorizer that maps
 * Hebrew product names to an id lives in `packages/db/src/index.ts`
 * (re-exported from `apps/api/src/shopping/categorize.ts`).
 */

export type ShoppingCategoryId =
  | "vegetables"
  | "bakery"
  | "dairy"
  | "pantry"
  | "snacks"
  | "frozen"
  | "household";

export interface ShoppingCategoryMeta {
  id: ShoppingCategoryId;
  nameHe: string;
  icon: string;
  /** Walking order through the store. 1 = first station. */
  order: number;
}

export const SHOPPING_CATEGORIES: ReadonlyArray<ShoppingCategoryMeta> = [
  { id: "vegetables", nameHe: "ירקות ופירות", icon: "🥦", order: 1 },
  { id: "bakery",     nameHe: "מאפים",         icon: "🍞", order: 2 },
  { id: "dairy",      nameHe: "מוצרי חלב",    icon: "🥛", order: 3 },
  { id: "pantry",     nameHe: "מזווה",          icon: "🥫", order: 4 },
  { id: "snacks",     nameHe: "חטיפים",         icon: "🍫", order: 5 },
  { id: "frozen",     nameHe: "קפואים",         icon: "❄️", order: 6 },
  { id: "household",  nameHe: "ניקוי ובית",    icon: "🧹", order: 7 },
];

/** Safe default when a name cannot be confidently categorized. */
export const SHOPPING_CATEGORY_FALLBACK: ShoppingCategoryId = "pantry";

export function shoppingCategoryMeta(id: ShoppingCategoryId): ShoppingCategoryMeta {
  const found = SHOPPING_CATEGORIES.find((c) => c.id === id);
  if (!found) {
    // Defensive: shouldn't happen because ShoppingCategoryId is a union
    // of literal strings. Fall back to pantry meta if a corrupted id slips in.
    return SHOPPING_CATEGORIES.find((c) => c.id === SHOPPING_CATEGORY_FALLBACK)!;
  }
  return found;
}

export function isShoppingCategoryId(value: unknown): value is ShoppingCategoryId {
  return typeof value === "string" && SHOPPING_CATEGORIES.some((c) => c.id === value);
}
