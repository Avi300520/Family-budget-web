// `CC_UX_BUILD` item 6 — where "back" goes. A predicate that decides navigation on a money screen
// is not something to leave to a browser walk alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { backLinkFor } from "./backLink.ts";

test("the three separate-accounts pages finally have a way back", () => {
  // 🔴 THE DEFECT, AS AN ASSERTION. Before this, all three returned nothing: no nav entry, no back
  //    link, and the only ways in were buttons inside the feature itself.
  assert.deepEqual(backLinkFor("/my-record"), { href: "/settings/separate-accounts", label: "חזרה להפרדת כספים" });
  assert.deepEqual(backLinkFor("/my-income"), { href: "/settings/separate-accounts", label: "חזרה להפרדת כספים" });
  // `/shared-expenses` is opened from the month's expenses and from `/my-record`'s list — never
  // from settings. A back link to a screen the person has not been on is worse than none.
  assert.deepEqual(backLinkFor("/shared-expenses"), { href: "/dashboard/spending", label: "חזרה להוצאות החודש" });
});

test("the pre-existing settings behaviour is unchanged, hub included", () => {
  assert.deepEqual(backLinkFor("/settings/separate-accounts"), { href: "/settings", label: "חזרה להגדרות" });
  assert.deepEqual(backLinkFor("/settings/members"), { href: "/settings", label: "חזרה להגדרות" });
  assert.deepEqual(backLinkFor("/receipts"), { href: "/settings", label: "חזרה להגדרות" });
  assert.deepEqual(backLinkFor("/export"), { href: "/settings", label: "חזרה להגדרות" });
  // The hub is the destination; it never points at itself.
  assert.equal(backLinkFor("/settings"), null);
});

test("every other route still has none, and a missing pathname does not throw", () => {
  for (const p of ["/dashboard", "/dashboard/spending", "/family/wishlists", "/login", "/"]) {
    assert.equal(backLinkFor(p), null, `${p} grew a back link`);
  }
  assert.equal(backLinkFor(null), null);
  assert.equal(backLinkFor(undefined), null);
  assert.equal(backLinkFor(""), null);
});
