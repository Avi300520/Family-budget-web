"use client";

import { useEffect, useState } from "react";
import type { BaselineAlerts } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { NotificationsEditor } from "../../../components/NotificationsEditor";
import { api } from "../../../lib/api";
import { useViewer } from "../../../lib/useViewer";
import { canViewHouseholdSettings } from "../../../lib/settingsView";

// Smart defaults when the household has no persisted `alerts` block yet (e.g. an
// older baseline written before the alerts step existed). Mirrors the onboarding
// step's defaults — weekly summary off, everything else on.
const DEFAULT_ALERTS: BaselineAlerts = {
  cat80: true,
  cat100: true,
  billUp: true,
  unusual: true,
  monthly: true,
  weekly: false,
};

// Persistence is REAL: NotificationsEditor runs in SELF-PERSIST mode and PATCHes
// households.financial_baseline.alerts on every toggle via the manager-gated
//   PATCH /api/v1/households/:id/financial-baseline/alerts  (body: Partial<BaselineAlerts>)
// (api.updateAlerts). Each toggle is optimistic - the editor reverts + shows a small
// inline error on failure, and a brief "נשמר" confirmation on success. No save bar.
// This page only fetches the household once (for its id + current alerts) and hands
// both to the editor as initial state.
export default function NotificationsPage() {
  const viewer = useViewer();
  const canManage = canViewHouseholdSettings(viewer.caps);
  const [data, setData] = useState<{ householdId: string; alerts: BaselineAlerts } | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Only fetch once the viewer is resolved AND the caller is a household manager.
    // limited_member / plain adult_member (no permissions.all) never issue the
    // request — client-side short-circuit that mirrors the manager-gated backend
    // household reads, so we never surface an action the backend would 403.
    if (viewer.status !== "ready" || !canManage) return;
    let cancelled = false;
    api
      .currentHousehold()
      .then(({ household }) => {
        if (cancelled) return;
        setData({ householdId: household.id, alerts: household.financialBaseline?.alerts ?? DEFAULT_ALERTS });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את העדפות ההתראות.");
      });
    return () => {
      cancelled = true;
    };
  }, [viewer.status, canManage]);

  // Viewer still resolving, or transient /me failure → explicit load/error state.
  // a11y 1.3.1/2.4.6: every rendered state needs exactly one <h1>. These two
  // branches render before the visible "page-title" heading exists, so they carry
  // an .sr-only one - same accessible name, zero pixels moved.
  if (viewer.status === "loading") {
    return (
      <AppShell>
        <h1 className="sr-only">התראות</h1>
        <LoadState />
      </AppShell>
    );
  }
  if (viewer.status === "error") {
    return (
      <AppShell>
        <h1 className="sr-only">התראות</h1>
        <LoadState error="לא הצלחנו לטעון את הפרטים. נסו לרענן." />
      </AppShell>
    );
  }

  // Manager-gated: limited_member and plain adult_member see a friendly access
  // message, exactly like the other manager-gated settings screens.
  if (!canManage) {
    return (
      <AppShell>
        <h1 className="page-title">התראות</h1>
        <section className="panel">
          <p className="muted">לעריכת התראות משק הבית נדרשת הרשאת ניהול של משק הבית.</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="page-title">התראות</h1>
      <p className="muted" style={{ marginBottom: "var(--sp-5)" }}>
        מתי נעדכן אתכם - בחרנו ברירות מחדל חכמות, ולא נציף אתכם.
      </p>

      {error && (
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <LoadState error={error} />
        </div>
      )}

      {!error && data === null && <LoadState />}

      {data !== null && <NotificationsEditor householdId={data.householdId} initialAlerts={data.alerts} />}

      {/* Footer tip — quiet explanation of the bill-increase guardrail. */}
      <div
        className="panel"
        style={{ background: "var(--teal-bg)", marginTop: "var(--sp-5)" }}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          📈 חשבון קבוע מתריע רק כשעלה גם באחוז משמעותי (10%+) וגם בסכום אמיתי (30 ₪+) - בלי רעש מיותר.
        </p>
      </div>
    </AppShell>
  );
}
