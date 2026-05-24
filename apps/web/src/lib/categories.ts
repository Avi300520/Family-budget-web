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
