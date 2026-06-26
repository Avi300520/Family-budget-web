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

// SAVE-GAP (intentional, documented): there is currently NO backend endpoint to
// persist an individual alert toggle. Alert preferences are only written as part of
// the full onboarding baseline (POST /onboarding/complete), and we must NOT re-POST
// the whole baseline just to flip one switch. So this screen is preview-only: toggles
// mutate LOCAL state so the owner can see/interact with the design, but nothing is
// persisted and we never show a "נשמר" confirmation.
// Minimal backend dependency to make this real: a focused
//   PATCH /api/v1/households/:id/financial-baseline/alerts  (body: Partial<BaselineAlerts>)
// endpoint (manager-gated) that updates only households.financial_baseline.alerts.
export default function NotificationsPage() {
  const viewer = useViewer();
  const canManage = canViewHouseholdSettings(viewer.caps);
  const [alerts, setAlerts] = useState<BaselineAlerts | null>(null);
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
        setAlerts(household.financialBaseline?.alerts ?? DEFAULT_ALERTS);
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
  if (viewer.status === "loading") {
    return (
      <AppShell>
        <LoadState />
      </AppShell>
    );
  }
  if (viewer.status === "error") {
    return (
      <AppShell>
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
      <p className="muted" style={{ marginBottom: "var(--sp-3)" }}>
        מתי נעדכן אתכם - בחרנו ברירות מחדל חכמות, ולא נציף אתכם.
      </p>

      {/* Honest save-gap note — preview only, persistence not wired yet. */}
      <p className="muted" style={{ fontSize: 13, marginBottom: "var(--sp-5)" }}>
        שמירת ההעדפות תופעל בקרוב (דורש חיבור שרת).
      </p>

      {error && (
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <LoadState error={error} />
        </div>
      )}

      {!error && alerts === null && <LoadState />}

      {alerts !== null && (
        <NotificationsEditor
          value={alerts}
          onChange={(key, next) => setAlerts((a) => (a ? { ...a, [key]: next } : a))}
        />
      )}

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
