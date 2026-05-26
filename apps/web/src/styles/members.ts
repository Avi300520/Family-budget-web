/**
 * Deterministic mapping from a household member id to one of the five
 * family palette colors (mom/dad/teen/kid/kid2). Same id always returns
 * the same color, so an avatar looks the same across devices and reloads
 * without any backend round-trip.
 *
 * This is the temporary client-side hash used by Iterations 1–5. From
 * Iteration 6 onward, the household_members row carries a `color` column
 * and the API is the source of truth; the hash stays as a fallback when
 * the column is null (newly joined members before an owner picks).
 */

import { tokens, type MemberColorKey } from "./tokens";

const PALETTE_KEYS: readonly MemberColorKey[] = ["mom", "dad", "teen", "kid", "kid2"] as const;

/** Stable FNV-1a 32-bit hash so SSR and CSR agree. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick a palette key for an unknown member id. */
export function memberKeyFor(memberId: string): MemberColorKey {
  return PALETTE_KEYS[hash(memberId) % PALETTE_KEYS.length]!;
}

/**
 * Returns the CSS color string for a member. If the server has assigned
 * a key, pass it in; otherwise we deterministically pick from the id.
 */
export function colorFor(memberId: string, assigned?: MemberColorKey | null): string {
  const key = assigned ?? memberKeyFor(memberId);
  return tokens.members[key];
}
