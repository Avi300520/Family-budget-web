// Unit tests for the roster predicates behind the settings-hub "👥" pill and the
// wishlists "בחירת ילד" picker.
// Run with: node --experimental-strip-types --test src/lib/roster.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { HouseholdMember } from "@shopping-assistant/shared-types";
import { activeMemberCount, activeChildren } from "./roster.ts";

type CountRow = Pick<HouseholdMember, "status">;
type ChildRow = Pick<HouseholdMember, "role" | "status"> & { userId: string };

test("activeMemberCount counts only status === 'active' — invited and removed excluded", () => {
  const roster: CountRow[] = [
    { status: "active" },
    { status: "active" },
    { status: "removed" },
    { status: "invited" }
  ];
  assert.equal(activeMemberCount(roster), 2);
  // The bug was `roster.length`: it must NOT agree with the raw array length here.
  assert.notEqual(activeMemberCount(roster), roster.length);
});

test("activeMemberCount: the reported household — 1 owner + 2 removed reads 1, not 3", () => {
  const roster: CountRow[] = [{ status: "active" }, { status: "removed" }, { status: "removed" }];
  assert.equal(activeMemberCount(roster), 1);
});

test("activeMemberCount: empty and all-removed rosters count as 0", () => {
  assert.equal(activeMemberCount([]), 0);
  assert.equal(activeMemberCount([{ status: "removed" }, { status: "removed" }]), 0);
});

test("activeChildren excludes a removed limited_member, includes an active one", () => {
  const members: ChildRow[] = [
    { userId: "child-active", role: "limited_member", status: "active" },
    { userId: "child-removed", role: "limited_member", status: "removed" },
    { userId: "parent", role: "owner", status: "active" }
  ];
  assert.deepEqual(
    activeChildren(members).map((m) => m.userId),
    ["child-active"]
  );
});

test("activeChildren excludes an invited (not yet joined) limited_member", () => {
  const members: ChildRow[] = [{ userId: "child-invited", role: "limited_member", status: "invited" }];
  assert.deepEqual(activeChildren(members), []);
});

test("activeChildren: a roster with no children yields an empty picker", () => {
  const members: ChildRow[] = [{ userId: "p", role: "owner", status: "active" }];
  assert.deepEqual(activeChildren(members), []);
});
