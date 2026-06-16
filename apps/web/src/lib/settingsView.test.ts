// Pure unit tests for the settings/nav role-visibility policy.
// Run with:  node --experimental-strip-types --test src/lib/settingsView.test.ts
// (FE repo has no vitest; Node's built-in runner. settingsView.ts is runtime-import-free.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { isVisibleForRole, filterByRole, canEditBaseline, type RoleGated } from "./settingsView.ts";

const CARDS: ReadonlyArray<RoleGated & { key: string }> = [
  { key: "household", roles: ["owner", "admin"] },
  { key: "members", roles: ["owner", "admin"] },
  { key: "edit-baseline", roles: ["owner", "admin"] },
  { key: "budget", roles: ["owner", "admin", "adult_member"] },
  { key: "privacy", roles: "all" }
];

test("owner sees every card", () => {
  assert.deepEqual(filterByRole(CARDS, "owner").map((c) => c.key),
    ["household", "members", "edit-baseline", "budget", "privacy"]);
});

test("admin sees every card", () => {
  assert.deepEqual(filterByRole(CARDS, "admin").map((c) => c.key),
    ["household", "members", "edit-baseline", "budget", "privacy"]);
});

test("adult_member sees only the cards scoped to them + 'all'", () => {
  assert.deepEqual(filterByRole(CARDS, "adult_member").map((c) => c.key), ["budget", "privacy"]);
});

test("limited_member sees only 'all' cards (no financial/management cards)", () => {
  assert.deepEqual(filterByRole(CARDS, "limited_member").map((c) => c.key), ["privacy"]);
});

test("an UNRESOLVED role hides every role-gated card but keeps 'all' (privacy)", () => {
  // This is the regressed production case: role undefined → only the roles:'all' card.
  // The settings UI must only reach this branch once viewer.status === 'ready'; while
  // loading/erroring it shows a loader/retry instead (see useViewer + the page).
  assert.deepEqual(filterByRole(CARDS, undefined).map((c) => c.key), ["privacy"]);
  assert.equal(isVisibleForRole({ roles: ["owner"] }, undefined), false);
  assert.equal(isVisibleForRole({ roles: "all" }, undefined), true);
});

test("canEditBaseline is owner/admin only (mirrors backend SEC-01b guard)", () => {
  assert.equal(canEditBaseline("owner"), true);
  assert.equal(canEditBaseline("admin"), true);
  assert.equal(canEditBaseline("adult_member"), false);
  assert.equal(canEditBaseline("limited_member"), false);
  assert.equal(canEditBaseline(undefined), false);
});
