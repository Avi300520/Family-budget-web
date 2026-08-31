// =============================================================================
// Settings / nav visibility policy — pure, runtime-import-free (only `import
// type`), so it loads under `node --experimental-strip-types --test` (same
// constraint as authRouting.ts / onboarding/model.ts). Components handle the
// loading / error / no-household *states* via useViewer(); this file owns the
// *capability* policy.
//
// CAPABILITY, not role-only (2026-06-16c owner decision): an `adult_member` whose
// membership carries `permissions.all === true` is a spouse / CO-MANAGER and is treated
// as a household manager — equal in practice to owner/admin for household operations.
// The backend now enforces this via `isHouseholdManager` (packages/db), so capability
// here MIRRORS the backend exactly — a surfaced card/action never 403s, and the UI never
// hides something the backend would allow:
//   - GET /households/:id/members        → owner/admin/adult_member (limited restricted)
//   - POST /members/invite               → household MANAGER (owner/admin/adult+all);
//       inviting an ADMIN role specifically → owner/admin only
//   - PATCH/DELETE members               → household MANAGER; role/permissions changes
//       and touching the owner → owner/admin only
//   - PATCH /households/:id/settings     → household MANAGER
//   - PUT/DELETE category-budgets        → household MANAGER
//   - POST/PATCH/DELETE project-budgets  → household MANAGER
//   - POST /onboarding/complete (baseline edit) → household MANAGER (backend SEC-01b)
//   - billing                            → owner/admin only (product policy)
// `permissions.all` is the FLOOR for co-management, never authority to mint other managers
// (assign admin / grant permissions.all) — those stay owner/admin (`isOwnerOrAdmin`).
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

/** True when the membership carries the full-capability flag (`permissions.all === true`). */
export function hasAllPermission(c: ViewerCaps): boolean {
  const p = c.permissions;
  return !!p && typeof p === "object" && (p as Record<string, unknown>).all === true;
}

/** Owner or admin. The privilege ceiling — who may mint/unmake managers, assign admin,
 *  or touch the owner. Mirrors the backend `isOwnerOrAdmin`. */
export function isOwnerOrAdmin(c: ViewerCaps): boolean {
  return roleIn(c.role, ["owner", "admin"]);
}

/** Household manager: owner, admin, OR an adult_member co-manager (`permissions.all`).
 *  The floor for household co-management. Mirrors the backend `isHouseholdManager`. */
export function isHouseholdManager(c: ViewerCaps): boolean {
  return isOwnerOrAdmin(c) || (c.role === "adult_member" && hasAllPermission(c));
}

// ── Capabilities (each mirrors the backend's actual authorization) ───────────────

/** See the household members roster. Backend GET /members allows adult_member; limited restricted. */
export function canViewHouseholdMembers(c: ViewerCaps): boolean {
  return roleIn(c.role, ["owner", "admin", "adult_member"]);
}

/** Invite / edit / remove members. Backend gates these to household managers
 *  (owner/admin/adult+all). NOTE: assigning the admin role or changing a member's
 *  role/permissions is owner/admin-only — gate those sub-controls with isOwnerOrAdmin. */
export function canManageHouseholdMembers(c: ViewerCaps): boolean {
  return isHouseholdManager(c);
}

/** See the household-settings section (budget / cycle / city). Owner/admin always;
 *  an adult_member only when granted full permissions (co-manager). */
export function canViewHouseholdSettings(c: ViewerCaps): boolean {
  return isHouseholdManager(c);
}

/**
 * ── `CC_UX_BUILD` / `R-2` BLOCKING 1 — **THE SECOND PERSON HAD NO DOOR.** ─────────────────────
 *
 * The separate-accounts card was gated on `canViewHouseholdSettings`, i.e. on being a MANAGER —
 * and the arrangement`s backend GET is open to every active adult (§A49; `household-routes.ts`
 * refuses only a `limited_member`). So the invited partner, who is the person this whole feature
 * exists for, was told on the join screen that they would see their share and that their income
 * stays private, and then given no route to either: not in the sidebar, not on the dashboard, and
 * not in the settings hub. The two screens built for them were reachable only by typing a URL.
 *
 * This mirrors the GET, which is the read the card leads to. The PUT stays manager-only and the
 * page itself renders read-only for everybody else — a door that opens onto a refusal is the same
 * defect one screen along.
 */
export function canViewSeparateAccounts(c: ViewerCaps): boolean {
  return roleIn(c.role, ["owner", "admin", "adult_member"]);
}

/** Change household settings. Backend PATCH /households/:id/settings is a manager op. */
export function canEditHouseholdSettings(c: ViewerCaps): boolean {
  return isHouseholdManager(c);
}

/** Category-budgets edit surface. Backend PUT/DELETE is a manager op. */
export function canViewCategoryBudgets(c: ViewerCaps): boolean {
  return isHouseholdManager(c);
}

/** Billing / plan. Owner/admin only (product policy keeps payment with owner/admin). */
export function canViewBilling(c: ViewerCaps): boolean {
  return isOwnerOrAdmin(c);
}

/** Re-enter onboarding to edit/correct the financial baseline. Backend SEC-01b on
 *  POST /onboarding/complete is a manager op (plain adult / limited → 403). */
export function canEditBaseline(c: ViewerCaps): boolean {
  return isHouseholdManager(c);
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
