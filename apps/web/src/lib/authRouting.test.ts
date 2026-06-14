// Pure routing-policy unit tests for the 2026-06-14 no-household dead-end fix.
// Run with:  node --experimental-strip-types --test src/lib/authRouting.test.ts
// (the FE repo has no vitest; this uses Node's built-in test runner, zero deps.)
//
// authRouting.ts is deliberately import-free so it loads standalone under
// `--experimental-strip-types`. Excluded from tsc/next via apps/web tsconfig.

import { test } from "node:test";
import assert from "node:assert/strict";
import { routeAfterConsume, requiresOnboarding, safeNextPath } from "./authRouting.ts";

// ── Required test 1 — consume, no household, next=/dashboard → /onboarding ──────
test("consume: no household + next=/dashboard redirects to /onboarding", () => {
  assert.equal(routeAfterConsume(false, "/dashboard"), "/onboarding");
});

// ── Required test 2 — consume, has household, next=/dashboard → /dashboard ──────
test("consume: has household + next=/dashboard still redirects to /dashboard", () => {
  assert.equal(routeAfterConsume(true, "/dashboard"), "/dashboard");
});

// ── No-household always wins over next (cannot be bypassed by the link) ─────────
test("consume: no household ignores next entirely (relative or hostile)", () => {
  assert.equal(routeAfterConsume(false, null), "/onboarding");
  assert.equal(routeAfterConsume(false, undefined), "/onboarding");
  assert.equal(routeAfterConsume(false, "/shopping-list"), "/onboarding");
  assert.equal(routeAfterConsume(false, "https://evil.com"), "/onboarding");
});

// ── Existing-user routing unchanged (no onboarding/login regression) ────────────
test("consume: has household, no next falls back to /dashboard", () => {
  assert.equal(routeAfterConsume(true, null), "/dashboard");
  assert.equal(routeAfterConsume(true, undefined), "/dashboard");
});

test("consume: has household honors a safe relative next (e.g. resume target)", () => {
  assert.equal(routeAfterConsume(true, "/shopping-list"), "/shopping-list");
  assert.equal(routeAfterConsume(true, "/settings/members"), "/settings/members");
});

test("consume: has household + unsafe next falls back to /dashboard (open-redirect guard intact)", () => {
  assert.equal(routeAfterConsume(true, "https://evil.com/x"), "/dashboard");
  assert.equal(routeAfterConsume(true, "//evil.com"), "/dashboard");
});

// ── Required test 3 — dashboard with no household must redirect (guard true) ────
test("dashboard: requiresOnboarding is true when /me returns no household", () => {
  assert.equal(requiresOnboarding(undefined), true);
  assert.equal(requiresOnboarding(null), true);
});

// ── Required test 4 — dashboard with household renders normally (guard false) ───
test("dashboard: requiresOnboarding is false when a household is present", () => {
  assert.equal(requiresOnboarding({ id: "h1", name: "household" }), false);
});

// ── safeNextPath policy preserved verbatim (no open-redirect regression) ────────
test("safeNextPath: absent/absolute/protocol-relative/backslash/control map to /dashboard", () => {
  assert.equal(safeNextPath(undefined), "/dashboard");
  assert.equal(safeNextPath(null), "/dashboard");
  assert.equal(safeNextPath(""), "/dashboard");
  assert.equal(safeNextPath("https://evil.com"), "/dashboard");
  assert.equal(safeNextPath("//evil.com"), "/dashboard");
  assert.equal(safeNextPath("/" + String.fromCharCode(92) + "evil.com"), "/dashboard"); // /\evil
  assert.equal(safeNextPath("/" + String.fromCharCode(0x01) + "x"), "/dashboard");      // control char
  assert.equal(safeNextPath("/" + String.fromCharCode(0x7f) + "x"), "/dashboard");      // DEL
});

test("safeNextPath: safe same-origin relative path passes through", () => {
  assert.equal(safeNextPath("/dashboard"), "/dashboard");
  assert.equal(safeNextPath("/onboarding"), "/onboarding");
  assert.equal(safeNextPath("/join?token=abc"), "/join?token=abc");
});
