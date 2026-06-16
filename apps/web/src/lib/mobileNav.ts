// =============================================================================
// Mobile bottom-nav layout policy — pure, runtime-import-free (loads under
// `node --experimental-strip-types --test`, same constraint as settingsView.ts).
//
// The mobile bar/sheet are driven off the SAME role-filtered link list the desktop
// sidebar uses (AppShell passes `filterByRole(ALL_LINKS, role)` straight in). This
// module only decides PRESENTATION — which visible links become bottom-bar tabs vs.
// which go into the grouped "עוד" sheet. It never decides visibility, so it can never
// re-expose a role-gated link. `groupMore` is exhaustive: every non-primary link lands
// in a group (falling back to "עוד"), so nothing is ever unreachable.
// =============================================================================

/** Bottom-bar tab destinations, in priority order. The first `max` that are visible
 *  for the viewer become tabs; the rest move to the "עוד" sheet. */
export const MOBILE_PRIMARY_HREFS: readonly string[] = [
  "/dashboard",
  "/budget",
  "/shopping-list",
  "/my-requests"
];

/** "עוד" sheet grouping (RTL, grouped — not a flat list). */
export const MOBILE_MORE_GROUPS: ReadonlyArray<{ title: string; hrefs: readonly string[] }> = [
  { title: "כספים", hrefs: ["/budget", "/insights", "/family/pulse"] },
  { title: "משפחה", hrefs: ["/family/wishlists", "/my-requests"] },
  { title: "חשבון", hrefs: ["/settings"] }
];

export function selectPrimary<T extends { href: string }>(links: readonly T[], max = 3): T[] {
  const byHref = new Map(links.map((l) => [l.href, l]));
  return MOBILE_PRIMARY_HREFS
    .map((h) => byHref.get(h))
    .filter((l): l is T => Boolean(l))
    .slice(0, max);
}

export function groupMore<T extends { href: string }>(
  links: readonly T[],
  primary: readonly T[]
): Array<{ title: string; items: T[] }> {
  const primaryHrefs = new Set(primary.map((l) => l.href));
  const more = links.filter((l) => !primaryHrefs.has(l.href));
  const groups = MOBILE_MORE_GROUPS.map((g) => ({
    title: g.title,
    items: more.filter((l) => g.hrefs.includes(l.href))
  })).filter((g) => g.items.length > 0);
  const placed = new Set(MOBILE_MORE_GROUPS.flatMap((g) => g.hrefs));
  const ungrouped = more.filter((l) => !placed.has(l.href));
  if (ungrouped.length > 0) groups.push({ title: "עוד", items: ungrouped });
  return groups;
}
