/**
 * ── `CC_UX_BUILD` item 6 — WHERE "BACK" GOES, AND FOR WHICH SCREENS THERE IS ONE ─────────────
 *
 * `AppShell` renders exactly one back affordance, once, for every route that has one. Until this
 * module it was an inline predicate covering `/settings/*`, `/receipts` and `/export` — and three
 * separate-accounts pages were reachable and had **no navigation and no way back at all**:
 * `/my-record`, `/my-income` and `/shared-expenses` appear in no nav list, and the only ways in are
 * buttons inside the feature itself. A person who followed one of them was stuck with the browser's
 * back button, on a money screen, in a product they were still learning.
 *
 * ⚠️ **THEY ARE NOT ADDED TO `ALL_LINKS`, AND THAT IS DELIBERATE.** These are destinations reached
 * FROM somewhere — the arrangement page, the month's expenses — not primary navigation, and they
 * are meaningless for a household that has not declared. A permanent sidebar entry for a feature
 * most households never turn on is clutter for everyone to fix a dead end for a few.
 *
 * ⚠️ **`/shared-expenses` GOES BACK TO THE EXPENSES, NOT TO SETTINGS.** It is opened from
 * `/dashboard/spending` (the door) and from `/my-record`'s list, and neither is a settings screen.
 * Sending it to `/settings` would be a back button that goes somewhere the person has never been —
 * which is worse than none, because it looks like it knows.
 *
 * Extracted rather than inlined so the rule is testable: `AppShell` is a client component with no
 * test runner in this repo, and a predicate that decides where "back" goes on a money screen is not
 * something to leave to the walk alone.
 */
export interface BackLink {
  readonly href: string;
  readonly label: string;
}

export function backLinkFor(pathname: string | null | undefined): BackLink | null {
  if (!pathname) return null;
  // The settings hub itself never gets one — it IS the destination.
  if (pathname === "/settings") return null;
  if (pathname.startsWith("/settings/") || pathname === "/receipts" || pathname === "/export") {
    return { href: "/settings", label: "חזרה להגדרות" };
  }
  if (pathname === "/my-record" || pathname === "/my-income") {
    return { href: "/settings/separate-accounts", label: "חזרה להפרדת כספים" };
  }
  if (pathname === "/shared-expenses") {
    return { href: "/dashboard/spending", label: "חזרה להוצאות החודש" };
  }
  return null;
}
