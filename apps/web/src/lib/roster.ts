// Roster predicates: "who is in this household RIGHT NOW".
//
// household_members.status is invited | active | removed, and GET /members deliberately
// returns ALL THREE. That is not a bug to fix server-side: the dashboard and the shopping
// list build their userId -> name/colour maps from the FULL roster, so a purchase made by
// a since-removed member still renders with their name and colour. The cost is that every
// view meaning "people who are here now" has to say so itself — and the two below did not,
// which is exactly what showed a removed member in a head-count and in a child picker.
//
// Import-free at runtime (`import type` is erased) so it loads standalone under
// `node --experimental-strip-types --test` — same convention as moneyInput.ts.

import type { HouseholdMember } from "@shopping-assistant/shared-types";

/** Head-count for the settings-hub "👥" pill. Excludes invited AND removed — an invite
 *  that was never accepted is not a member either. */
export function activeMemberCount(members: ReadonlyArray<Pick<HouseholdMember, "status">>): number {
  return members.filter((m) => m.status === "active").length;
}

/** Children eligible to own a wish (the wishlists "בחירת ילד" picker). Role alone is not
 *  enough — a removed child must not be offered as a recipient. */
export function activeChildren<T extends Pick<HouseholdMember, "role" | "status">>(
  members: ReadonlyArray<T>
): T[] {
  return members.filter((m) => m.role === "limited_member" && m.status === "active");
}
