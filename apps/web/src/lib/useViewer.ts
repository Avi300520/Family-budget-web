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
  const [hasHousehold, setHasHousehold] = useState(false);
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
        setHasHousehold(Boolean(me.household));
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // Do NOT silently degrade to "no role" — surface an error the UI can retry.
        setRole(undefined);
        setPermissions(null);
        setHasHousehold(false);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { status, role, permissions, caps: { role, permissions }, hasHousehold, retry };
}
