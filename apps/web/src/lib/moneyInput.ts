// Pure money-input parsing (NF-M18 / WP-MONEY-INPUT).
//
// The old MoneyInput onChange did `value.replace(/[^\d]/g, "")` — it stripped EVERY
// non-digit, so a decimal amount like "89.90" collapsed to "8990" → Number → 8990, a
// silent 100× overcharge on a ₪ field. This keeps digits plus a SINGLE decimal point;
// any other char (₪ prefix, spaces, thousands separators, letters, a second dot) is
// dropped. Empty / dot-only input maps to "" (the field's empty sentinel).
//
// Import-free and framework-free so it loads standalone under
// `node --experimental-strip-types --test` (see moneyInput.test.ts).
export function parseMoneyInput(raw: string): number | "" {
  const cleaned = raw.replace(/[^\d.]/g, ""); // digits + dots only
  // Longest valid numeric prefix: integer digits, at most ONE dot, fractional digits.
  // Anything past a second dot is dropped ("89.9.9" -> "89.9"), so a single decimal wins.
  const norm = cleaned.match(/^\d*\.?\d*/)?.[0] ?? "";
  if (norm === "" || norm === ".") return "";
  const n = Number(norm);
  return Number.isFinite(n) ? n : "";
}
