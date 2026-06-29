// Shared currency formatter. The app renders every ILS amount as a Hebrew-grouped
// integer with the shekel sign (e.g. "₪1,234"). Wrap the result in `.mono` at the
// call site so digits use JetBrains Mono / tabular-nums.
// ponytail: one helper; pages were each calling `₪${n.toLocaleString("he-IL")}` inline.
export function nis(n: number | null | undefined): string {
  return "₪" + Math.round(Number(n) || 0).toLocaleString("he-IL");
}
