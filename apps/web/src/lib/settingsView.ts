// =============================================================================
// Settings / nav visibility policy — pure, runtime-import-free (only `import
// type`), so it loads under `node --experimental-strip-types --test` (same
// constraint as authRouting.ts / onboarding/model.ts). Components handle the
// loading / error / no-household *states* via useViewer(); this file owns the
// *capability* policy.
//
// CAPABILITY, not role-only (2026-06-16b owner evidence): the settings index
// previously gated every management card to roles ["owner","admin"], so an
// `adult_member` — even one carrying `permissions.all = true` — was filtered out
// of all of them and saw ONLY the roles:"all" privacy card. The fix is to gate by
// capability, derived from role + the membership `permissions` object, and aligned
// with what the backend actually authorizes so a surfaced card never 403s on the
// action it implies:
//   - GET /households/:id/members        → owner/admin/adult_member (limited restricted)
//   - POST/PATCH/DELETE members          → owner/admin only
//   - GET /households/current (settings) → any member (read); PATCH settings → owner/admin only
//   - GET /category-budgets              → owner/admin/adult_member; PUT/DELETE → owner/admin
//     (the category-budgets PAGE is edit-only → its card stays owner/admin)
//   - POST /onboarding/complete (baseline edit) → owner/admin only (backend SEC-01b)
// The backend authorizes by ROLE (it does not read `permissions`), so capability
// here must not exceed role enforcement for WRITES. `permissions.all` only widens
// READ/visibility where product policy asks for it (e.g. the household-settings card).
// =============================================================================

import type { HouseholdRole } from "@shopping-assistant/shared-types";

/** The viewer's membership facts used for capability decisions. */
export interface ViewerCaps {
  role?: HouseholdRole;
  /** Opaque membership permissions; the backend sets `{ all: true }` for full capability. */
  permissions?: Record<string, unknown> | null;
}

function roleIn(role: HouseholdRole | undefined, allowed: ReadonlyArray<HouseholdRole>): boolean {
  return role !== undefined && allowed.includes(role);
}

const isOwnerAdmin = (c: ViewerCaps): boolean => roleIn(c.role, ["owner", "admin"]);

/** True when the membership carries the full-capability flag (`permissions.all === true`). */
export function hasAllPermission(c: ViewerCaps): boolean {
  const p = c.permissions;
  return !!p && typeof p === "object" && (p as Record<string, unknown>).all === true;
}

// ── Capabilities (each mirrors the backend's actual authorization) ───────────────

/** See the household members roster. Backend GET /members allows adult_member; limited restricted. */
export function canViewHouseholdMembers(c: ViewerCaps): boolean {
  return roleIn(c.role, ["owner", "admin", "adult_member"]);
}

/** Invite / edit / remove members. Backend gates these to owner/admin only. */
export function canManageHouseholdMembers(c: ViewerCaps): boolean {
  return isOwnerAdmin(c);
}

/** See the household-settings section (budget / cycle / city). Owner/admin always;
 *  an adult_member only when granted full permissions (`permissions.all`). */
export function canViewHouseholdSettings(c: ViewerCaps): boolean {
  return isOwnerAdmin(c) || (c.role === "adult_member" && hasAllPermission(c));
}

/** Change household settings. Backend PATCH /households/:id/settings is owner/admin only. */
export function canEditHouseholdSettings(c: ViewerCaps): boolean {
  return isOwnerAdmin(c);
}

/** The category-budgets surface is an edit page (owner/admin). Backend write is owner/admin. */
export function canViewCategoryBudgets(c: ViewerCaps): boolean {
  return isOwnerAdmin(c);
}

/** Billing / plan. Owner/admin only (no product policy grants adult_member yet). */
export function canViewBilling(c: ViewerCaps): boolean {
  return isOwnerAdmin(c);
}

/** Re-enter onboarding to edit/correct the financial baseline. Backend SEC-01b on
 *  POST /onboarding/complete is owner/admin only (adult_member → 403; limited never). */
export function canEditBaseline(c: ViewerCaps): boolean {
  return isOwnerAdmin(c);
}

// ── Role-only helpers (still used by AppShell nav, whose links map 1:1 to
//    role-gated backend features: budget/insights/pulse = adult+, wishlists = owner/admin). ──

/** An item gated to a set of roles, or visible to everyone (`"all"`). */
export interface RoleGated {
  roles: HouseholdRole[] | "all";
}

export function isVisibleForRole<T extends RoleGated>(item: T, role: HouseholdRole | undefined): boolean {
  if (item.roles === "all") return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export function filterByRole<T extends RoleGated>(items: ReadonlyArray<T>, role: HouseholdRole | undefined): T[] {
  return items.filter((item) => isVisibleForRole(item, role));
}
