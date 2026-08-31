"use client";

import { useCallback, useEffect, useState } from "react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import type { ViewerCaps } from "./settingsView";
import { api } from "./api";

/**
 * Resolve the current viewer (role + whether they have a household) with EXPLICIT
 * loading / error / ready states.
 *
 * This replaces the previous `api.me().then(me => setRole(me.membership?.role)).catch(() => undefined)`
 * pattern used by the settings index and AppShell, where `role === undefined` conflated
 * three very different situations — still loading, /me failed (transient), and the user
 * genuinely has no membership — and silently collapsed the UI to "privacy only" / a
 * stripped nav with no loading indicator, error, or retry. Callers can now branch on
 * `status` and only treat a missing role as "hidden" once `status === "ready"`.
 */
export type ViewerStatus = "loading" | "ready" | "error";

export interface Viewer {
  status: ViewerStatus;
  /** The caller's household role, once resolved. Undefined while loading, on error, or when the user has no membership. */
  role?: HouseholdRole;
  /** The caller's membership permissions object (backend sets `{ all: true }` for full capability). */
  permissions?: Record<string, unknown> | null;
  /** The signed-in user's display name (sidebar identity block / greeting). */
  displayName?: string;
  /** The household name (sidebar identity block / settings banner). */
  householdName?: string;
  /** The signed-in user's id. SEPACCT joins split shares against it - a share carries a userId
   *  and no display name (SEPACCT_FRONTEND_SPEC.md section 6 item 1). */
  userId?: string;
  /** The household's id. Every SEPACCT route but the arrangement GET is keyed by it. */
  householdId?: string;
  /** SEPACCT: when this household declared the arrangement. SERVER-SET, absent while the backend
   *  flag is off, and deliberately KEPT when the arrangement is turned back off - so the settings
   *  copy can say what switching off does without promising an erasure that does not happen. */
  separateAccountsDeclaredAt?: string;
  /** Convenience bundle for the capability helpers in settingsView.ts. */
  caps: ViewerCaps;
  /** True when the authenticated user belongs to a household (membership resolved). */
  hasHousehold: boolean;
  /** Re-run /me (used by an error-retry affordance). */
  retry: () => void;
}

export function useViewer(): Viewer {
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [role, setRole] = useState<HouseholdRole>();
  const [permissions, setPermissions] = useState<Record<string, unknown> | null>(null);
  const [displayName, setDisplayName] = useState<string>();
  const [householdName, setHouseholdName] = useState<string>();
  const [hasHousehold, setHasHousehold] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [householdId, setHouseholdId] = useState<string>();
  const [declaredAt, setDeclaredAt] = useState<string>();
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setRole(me.membership?.role);
        // Capability gating reads `permissions` (e.g. `permissions.all`), so carry it through.
        setPermissions((me.membership?.permissions as Record<string, unknown> | undefined) ?? null);
        setDisplayName(me.user?.displayName ?? undefined);
        setHouseholdName(me.household?.name ?? undefined);
        setHasHousehold(Boolean(me.household));
        setUserId(me.user?.id);
        setHouseholdId(me.household?.id);
        setDeclaredAt(me.household?.financialBaseline?.profile?.separateAccountsDeclaredAt);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // Do NOT silently degrade to "no role" — surface an error the UI can retry.
        setRole(undefined);
        setPermissions(null);
        setDisplayName(undefined);
        setHouseholdName(undefined);
        setHasHousehold(false);
        setUserId(undefined);
        setHouseholdId(undefined);
        setDeclaredAt(undefined);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { status, role, permissions, displayName, householdName, userId, householdId, separateAccountsDeclaredAt: declaredAt, caps: { role, permissions }, hasHousehold, retry };
}
