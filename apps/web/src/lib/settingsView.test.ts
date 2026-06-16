// Pure unit tests for the settings/nav capability + role-visibility policy.
// Run with:  node --experimental-strip-types --test src/lib/settingsView.test.ts
// (FE repo has no vitest; Node's built-in runner. settingsView.ts is runtime-import-free.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasAllPermission,
  canViewHouseholdMembers,
  canManageHouseholdMembers,
  canViewHouseholdSettings,
  canEditHouseholdSettings,
  canViewCategoryBudgets,
  canViewBilling,
  canEditBaseline,
  isVisibleForRole,
  filterByRole,
  type ViewerCaps,
  type RoleGated
} from "./settingsView.ts";
import type { HouseholdRole } from "@shopping-assistant/shared-types";

const owner: ViewerCaps = { role: "owner", permissions: { all: true } };
const admin: ViewerCaps = { role: "admin", permissions: { all: true } };
const adultAll: ViewerCaps = { role: "adult_member", permissions: { all: true } };
const adultBase: ViewerCaps = { role: "adult_member", permissions: {} };
const limited: ViewerCaps = { role: "limited_member", permissions: {} };
const unknown: ViewerCaps = { role: undefined, permissions: null };

// ── hasAllPermission ─────────────────────────────────────────────────────────────
test("hasAllPermission reads permissions.all defensively", () => {
  assert.equal(hasAllPermission({ permissions: { all: true } }), true);
  assert.equal(hasAllPermission({ permissions: { all: false } }), false);
  assert.equal(hasAllPermission({ permissions: {} }), false);
  assert.equal(hasAllPermission({ permissions: null }), false);
  assert.equal(hasAllPermission({}), false);
});

// ── individual capabilities ────────────────────────────────────────────────────
test("canViewHouseholdMembers: owner/admin/adult; NOT limited or unknown", () => {
  assert.equal(canViewHouseholdMembers(owner), true);
  assert.equal(canViewHouseholdMembers(admin), true);
  assert.equal(canViewHouseholdMembers(adultAll), true);
  assert.equal(canViewHouseholdMembers(adultBase), true);
  assert.equal(canViewHouseholdMembers(limited), false);
  assert.equal(canViewHouseholdMembers(unknown), false);
});

test("canManageHouseholdMembers: owner/admin only (matches backend invite/update/remove)", () => {
  assert.equal(canManageHouseholdMembers(owner), true);
  assert.equal(canManageHouseholdMembers(admin), true);
  assert.equal(canManageHouseholdMembers(adultAll), false);
  assert.equal(canManageHouseholdMembers(limited), false);
});

test("canViewHouseholdSettings: owner/admin always; adult ONLY with permissions.all", () => {
  assert.equal(canViewHouseholdSettings(owner), true);
  assert.equal(canViewHouseholdSettings(admin), true);
  assert.equal(canViewHouseholdSettings(adultAll), true);
  assert.equal(canViewHouseholdSettings(adultBase), false);
  assert.equal(canViewHouseholdSettings(limited), false);
});

test("canEditHouseholdSettings: owner/admin only (backend PATCH gate) — even adult+all cannot edit", () => {
  assert.equal(canEditHouseholdSettings(owner), true);
  assert.equal(canEditHouseholdSettings(admin), true);
  assert.equal(canEditHouseholdSettings(adultAll), false);
  assert.equal(canEditHouseholdSettings(limited), false);
});

test("canViewCategoryBudgets / canViewBilling / canEditBaseline: owner/admin only", () => {
  for (const cap of [canViewCategoryBudgets, canViewBilling, canEditBaseline]) {
    assert.equal(cap(owner), true);
    assert.equal(cap(admin), true);
    assert.equal(cap(adultAll), false); // adult+all still cannot (backend/edit-only page)
    assert.equal(cap(adultBase), false);
    assert.equal(cap(limited), false);
    assert.equal(cap(unknown), false);
  }
});

// ── settings index integration (mirrors the CARDS `can` predicates) ──────────────
interface Card { key: string; can: (c: ViewerCaps) => boolean; }
const CARDS: Card[] = [
  { key: "household", can: canViewHouseholdSettings },
  { key: "members", can: canViewHouseholdMembers },
  { key: "category", can: canViewCategoryBudgets },
  { key: "edit-baseline", can: canEditBaseline },
  { key: "billing", can: canViewBilling },
  { key: "privacy", can: () => true }
];
const visible = (c: ViewerCaps) => CARDS.filter((card) => card.can(c)).map((card) => card.key);

test("owner/admin see every settings card", () => {
  assert.deepEqual(visible(owner), ["household", "members", "category", "edit-baseline", "billing", "privacy"]);
  assert.deepEqual(visible(admin), ["household", "members", "category", "edit-baseline", "billing", "privacy"]);
});

test("adult_member with permissions.all sees household+members+privacy — NOT reduced to privacy-only", () => {
  const keys = visible(adultAll);
  assert.deepEqual(keys, ["household", "members", "privacy"]);
  assert.notEqual(keys.length, 1); // the reported regression: must not be privacy-only
  assert.ok(keys.includes("members"));
  assert.ok(keys.includes("household"));
});

test("adult_member WITHOUT permissions.all still sees members+privacy — NOT privacy-only", () => {
  const keys = visible(adultBase);
  assert.deepEqual(keys, ["members", "privacy"]);
  assert.notEqual(keys.length, 1);
});

test("limited_member sees only privacy (no financial/management cards)", () => {
  assert.deepEqual(visible(limited), ["privacy"]);
});

test("unknown/unresolved caps fall back to privacy-only (UI shows loader/error before reaching this)", () => {
  assert.deepEqual(visible(unknown), ["privacy"]);
});

// ── nav role-gating (AppShell still uses filterByRole; verify adult nav not stripped) ──
const NAV: ReadonlyArray<RoleGated & { key: string }> = [
  { key: "dashboard", roles: "all" },
  { key: "shopping", roles: "all" },
  { key: "budget", roles: ["owner", "admin", "adult_member"] },
  { key: "insights", roles: ["owner", "admin", "adult_member"] },
  { key: "pulse", roles: ["owner", "admin", "adult_member"] },
  { key: "wishlists", roles: ["owner", "admin"] },
  { key: "settings", roles: "all" }
];

test("AppShell nav: adult_member keeps budget/insights/pulse (not stripped to 'all' only)", () => {
  const keys = filterByRole(NAV, "adult_member").map((l) => l.key);
  assert.deepEqual(keys, ["dashboard", "shopping", "budget", "insights", "pulse", "settings"]);
});

test("AppShell nav: limited_member keeps only 'all' links; owner keeps everything", () => {
  assert.deepEqual(filterByRole(NAV, "limited_member").map((l) => l.key), ["dashboard", "shopping", "settings"]);
  assert.equal(filterByRole(NAV, "owner").length, NAV.length);
});

test("isVisibleForRole basics", () => {
  assert.equal(isVisibleForRole({ roles: "all" }, undefined), true);
  assert.equal(isVisibleForRole({ roles: ["owner"] as HouseholdRole[] }, undefined), false);
  assert.equal(isVisibleForRole({ roles: ["adult_member"] as HouseholdRole[] }, "adult_member"), true);
});
