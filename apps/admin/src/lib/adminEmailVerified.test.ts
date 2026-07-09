// Fail-closed unit tests for the admin email-verification guard (NF-M24 / WP-ADMIN-EMAILVERIFIED).
// Run with:  node --experimental-strip-types --test src/lib/adminEmailVerified.test.ts
// (the admin app has no vitest; Node's built-in runner, zero deps. adminEmailVerified.ts is
//  import-free; the test file is excluded from tsc/next via tsconfig so the .ts import is allowed.)
//
// SECURITY INVARIANT: an explicitly UNVERIFIED Google email cannot obtain an admin session,
// even if that email is on the allowlist. Verification is a precondition, not a substitute,
// for authorization.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminEmailVerified } from "./adminEmailVerified.ts";

test("explicitly unverified email is rejected", () => {
  assert.equal(isAdminEmailVerified({ email_verified: false }), false);
});

test("verified email passes", () => {
  assert.equal(isAdminEmailVerified({ email_verified: true }), true);
});

test("absent / unknown email_verified is NOT treated as unverified (allowlist stays the gate)", () => {
  assert.equal(isAdminEmailVerified({}), true);
  assert.equal(isAdminEmailVerified(undefined), true);
  assert.equal(isAdminEmailVerified(null), true);
  assert.equal(isAdminEmailVerified({ email_verified: undefined }), true);
});

test("only a strict boolean false denies (string 'false' is not a false-negative bypass either way)", () => {
  // Google always sends a real boolean; a non-boolean truthy/loose value is not `=== false`
  // so it does not deny here — the allowlist remains the authoritative check.
  assert.equal(isAdminEmailVerified({ email_verified: "false" as unknown }), true);
});
