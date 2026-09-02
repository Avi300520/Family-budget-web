// SEPACCT — the parts that survive the swap from `sepacctMock` to the real routes.
// The wire is described in SEPACCT_FRONTEND_SPEC.md at the repository root; section numbers
// below refer to it.

/**
 * SEPACCT ships DORMANT. Every backend SEPACCT route sits behind its own flag, all seven are off,
 * and each therefore answers `404 http.not_found` in production today (§3). The frontend mirrors
 * that convention rather than inventing its own: the four routes and the onboarding step are
 * registered but render as ABSENT until this is armed.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so with the variable unset `next build` produces four
 * routes that render the 404 page and a wizard with no separate-accounts step — no mock-backed
 * surface is reachable, and no household is asked a question about a feature that does not exist.
 *
 * ponytail: one boolean, not a flag registry. There is exactly one feature behind it, and the
 * seven-way split lives in the backend where the routes are.
 */
export const SEPACCT_UI_ENABLED = process.env.NEXT_PUBLIC_SEPACCT_UI === "1";
/** Private-plan storage has its own backend migration and operator switch. */
export const SEPACCT_PERSONAL_PLAN_UI_ENABLED = process.env.NEXT_PUBLIC_SEPACCT_PERSONAL_PLAN === "1";

/** As much of the `DomainError` envelope as a caller needs: the stable `code`. */
export class SepacctError extends Error {
  // A plain field, not a constructor parameter property: `node --experimental-strip-types` is
  // strip-only and rejects the shorthand (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX), which is how
  // sepacct.test.ts runs.
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "SepacctError";
  }
}

/**
 * §3 — with its flag off every route answers 404, deliberately indistinguishable from a genuinely
 * missing resource, because a child and a disabled feature must look the same. `split.not_found`
 * is the same answer for a child on the split route.
 *
 * So this is NOT an error condition. The caller renders the feature as ABSENT — `notFound()` —
 * never an error panel, never an empty state that implies something went wrong, and never a retry.
 */
export function isAbsent(e: unknown): boolean {
  return e instanceof SepacctError && (e.code === "http.not_found" || e.code === "split.not_found");
}

/**
 * Shekel text → integer agorot, by string surgery and never `Number(x) * 100`: `18.25 * 100` is
 * 1824.9999999999998, and a non-integer is `400 income.invalid` on the wire (§3).
 *
 * Empty input is `{ agorot: null }` — that is the wire's "clear it", not a parse failure.
 */
export type AgorotInput = { ok: true; agorot: number | null } | { ok: false };

export function agorotFromInput(raw: string): AgorotInput {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, agorot: null };
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(trimmed);
  if (!match) return { ok: false };
  const agorot = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(agorot) ? { ok: true, agorot } : { ok: false };
}

/** The inverse, for seeding the field from a stored value. */
export function inputFromAgorot(agorot: number | null): string {
  if (agorot === null) return "";
  return `${Math.trunc(agorot / 100)}.${String(agorot % 100).padStart(2, "0")}`;
}
