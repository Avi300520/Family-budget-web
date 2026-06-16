// Verifies the mobile bottom-nav split is faithful to the role-filtered link set:
//   • the same filterByRole source feeds desktop AND mobile (no separate mobile model);
//   • every visible link is reachable on mobile (in a bottom tab OR the "עוד" sheet);
//   • the split never invents or drops a link (union == input, no duplicates).
// Run with: node --experimental-strip-types --test src/lib/mobileNav.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { filterByRole } from "./settingsView.ts";
import { selectPrimary, groupMore } from "./mobileNav.ts";

// Mirror of AppShell ALL_LINKS (href + role gating only — presentation fields omitted).
const LINKS: Array<{ href: string; roles: HouseholdRole[] | "all" }> = [
  { href: "/dashboard", roles: "all" },
  { href: "/shopping-list", roles: "all" },
  { href: "/my-requests", roles: ["limited_member"] },
  { href: "/budget", roles: ["owner", "admin", "adult_member"] },
  { href: "/insights", roles: ["owner", "admin", "adult_member"] },
  { href: "/family/pulse", roles: ["owner", "admin", "adult_member"] },
  { href: "/family/wishlists", roles: ["owner", "admin"] },
  { href: "/settings", roles: "all" }
];

const ROLES: HouseholdRole[] = ["owner", "admin", "adult_member", "limited_member"];

function reachableHrefs(role: HouseholdRole): { visible: string[]; reached: string[] } {
  const visible = filterByRole(LINKS, role);
  const primary = selectPrimary(visible);
  const groups = groupMore(visible, primary);
  const reached = [...primary.map((l) => l.href), ...groups.flatMap((g) => g.items.map((l) => l.href))];
  return { visible: visible.map((l) => l.href), reached };
}

// ── Invariant: exhaustive + no-duplication, for EVERY role ──────────────────────
for (const role of ROLES) {
  test(`mobile nav reaches exactly the role-visible links — ${role}`, () => {
    const { visible, reached } = reachableHrefs(role);
    assert.equal(new Set(reached).size, reached.length, "a link appears twice on mobile");
    assert.deepEqual([...reached].sort(), [...visible].sort(), "mobile must reach exactly the visible set");
  });
}

// ── Bottom-bar tabs per role (≤3, priority order) ───────────────────────────────
test("owner/adult bottom tabs = דשבורד, תקציב, קניות", () => {
  for (const role of ["owner", "admin", "adult_member"] as HouseholdRole[]) {
    const primary = selectPrimary(filterByRole(LINKS, role));
    assert.deepEqual(primary.map((l) => l.href), ["/dashboard", "/budget", "/shopping-list"]);
  }
});

test("limited_member bottom tabs = דשבורד, קניות, הבקשות שלי (no budget)", () => {
  const primary = selectPrimary(filterByRole(LINKS, "limited_member"));
  assert.deepEqual(primary.map((l) => l.href), ["/dashboard", "/shopping-list", "/my-requests"]);
});

test("limited_member never gets budget/insights/pulse/wishlists anywhere on mobile", () => {
  const { reached } = reachableHrefs("limited_member");
  for (const forbidden of ["/budget", "/insights", "/family/pulse", "/family/wishlists"]) {
    assert.ok(!reached.includes(forbidden), `${forbidden} must not be reachable for limited_member`);
  }
});

// ── "עוד" sheet is grouped (not a flat list) for owner ──────────────────────────
test("owner 'עוד' sheet groups the non-tab links", () => {
  const visible = filterByRole(LINKS, "owner");
  const groups = groupMore(visible, selectPrimary(visible));
  assert.deepEqual(groups.map((g) => g.title), ["כספים", "משפחה", "חשבון"]);
  assert.deepEqual(groups[0]!.items.map((l) => l.href), ["/insights", "/family/pulse"]);
});
