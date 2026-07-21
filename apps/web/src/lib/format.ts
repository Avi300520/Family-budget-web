// Shared currency formatter. The app renders every ILS amount as a Hebrew-grouped
// integer with the shekel sign (e.g. "₪1,234"). Wrap the result in `.mono` at the
// call site so digits use JetBrains Mono / tabular-nums.
// ponytail: one helper; pages were each calling `₪${n.toLocaleString("he-IL")}` inline.
export function nis(n: number | null | undefined): string {
  return "₪" + Math.round(Number(n) || 0).toLocaleString("he-IL");
}

// BATCH-GI F6 — dates were rendered by dropping the raw API value into the JSX, which produced
// "יעד: Invalid Date" on the dashboard project cards and a raw "Thu Aug 06 2026 00:00:00 GMT..."
// on /budget. Both are 1.3.1 failures (the text does not convey the information) and plain
// user-facing bugs. Returns null - not "Invalid Date", not today - when the input is missing or
// unparseable, so every call site must decide what to render instead.
export function heDate(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  // A bare "YYYY-MM-DD" (what ProjectBudget.endDate and Purchase.purchaseDate actually are) is
  // parsed as UTC midnight by spec, then rendered in the VIEWER's timezone - so west of UTC every
  // such date renders one day early. The code this replaced did `new Date(x + "T00:00:00")`
  // precisely to force a local-midnight parse; keep that. Israel is UTC+2/+3 so the shipped
  // audience never saw it, which is exactly why it would have survived review.
  const local = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const d = local instanceof Date ? local : new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}
