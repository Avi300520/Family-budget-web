// Admin sign-in email-verification guard (NF-M24 / WP-ADMIN-EMAILVERIFIED).
//
// A valid Google identity with an UNVERIFIED email must never obtain an admin session:
// email_verified:false means Google could not confirm the address belongs to the signer,
// so treating it as an authorized admin would let an attacker who controls an OAuth app /
// unverified account slip past. Google sets `email_verified: true` on verified accounts.
//
// We deny ONLY on an explicit `false`. An absent / unknown value (a reduced profile shape
// or a non-Google provider) is not treated as unverified here — the allowlist remains the
// primary authorization gate; this only closes the "verified identity" precondition.
//
// Import-free so it loads standalone under `node --experimental-strip-types --test`.
export function isAdminEmailVerified(
  profile: { email_verified?: unknown } | null | undefined
): boolean {
  return profile?.email_verified !== false;
}
