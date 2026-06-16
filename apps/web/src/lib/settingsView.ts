// =============================================================================
// Settings / nav role-visibility policy — pure, runtime-import-free (only
// `import type`), so it loads under `node --experimental-strip-types --test`
// (same constraint as authRouting.ts / onboarding/model.ts). The settings index
// and AppShell import these helpers; the loading/error/no-household *states* are
// handled in the components via useViewer().
//
// Why this exists: previously the settings index and the nav filtered cards/links
// purely on `role`, which is `undefined` while /me is loading, on a transient /me
// failure, AND when the user genuinely has no membership. All three collapsed to
// "only the roles:'all' items render" — i.e. the privacy-only settings page and a
// stripped nav, with no way to tell the cases apart. Splitting the *policy* (this
// file) from the *state* (useViewer) lets the UI show loading/error/onboarding
// affordances instead of silently degrading.
// =============================================================================

import type { HouseholdRole } from "@shopping-assistant/shared-types";

/** An item gated to a set of roles, or visible to everyone (`"all"`). */
export interface RoleGated {
  roles: HouseholdRole[] | "all";
}

/**
 * Whether a role-gated item is visible for a resolved role.
 * - `"all"` items are always visible (e.g. dashboard, settings, privacy).
 * - role-gated items require a matching role; an UNKNOWN role (undefined) hides
 *   them. Callers must only treat `undefined` as "hidden" once the viewer status
 *   is `ready` — while loading/erroring the UI shows a skeleton/retry instead, so
 *   a transient /me failure never permanently strips management UI.
 */
export function isVisibleForRole<T extends RoleGated>(item: T, role: HouseholdRole | undefined): boolean {
  if (item.roles === "all") return true;
  if (!role) return false;
  return item.roles.includes(role);
}

/** Filter a list of role-gated items for a resolved role. */
export function filterByRole<T extends RoleGated>(items: ReadonlyArray<T>, role: HouseholdRole | undefined): T[] {
  return items.filter((item) => isVisibleForRole(item, role));
}

/**
 * Who may re-enter onboarding to edit/correct the household financial baseline.
 * Mirrors the backend SEC-01b guard on POST /api/v1/onboarding/complete: only the
 * household owner or admin may overwrite an existing household (adult_member and
 * limited_member are rejected with 403, and limited_member never even receives the
 * baseline). Keeping the FE gate identical avoids showing a CTA that would 403.
 */
export function canEditBaseline(role: HouseholdRole | undefined): boolean {
  return role === "owner" || role === "admin";
}
