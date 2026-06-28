"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { BaselineAlerts } from "@shopping-assistant/shared-types";
import { api } from "../lib/api";

// ONE source of truth for the alert toggles, mounted in two modes:
//
//   SELF-PERSIST (settings) - pass `householdId`. The editor owns the alert state
//     (seeded from `initialAlerts` or fetched via currentHousehold) and PATCHes
//     financial_baseline.alerts on every toggle through the manager-gated
//     api.updateAlerts. Optimistic: it reverts + shows a small inline error on
//     failure, and a brief "נשמר" confirmation on success. NO save bar.
//
//   CONTROLLED (onboarding) - pass `value` + `onChange(next)`. The editor renders
//     `value` and reports the next BaselineAlerts; it never fetches or persists.
//     The wizard writes alerts as part of completeOnboarding.
//
// RTL Hebrew. `showChannel` (default true) hides the WhatsApp channel card so the
// onboarding step can drop it.

export type AlertKey = keyof BaselineAlerts;

interface AlertRow {
  key: AlertKey;
  emoji: string;
  title: string;
  sub: string;
}

interface AlertGroup {
  label: string;
  rows: AlertRow[];
}

// Keys + copy mirror the onboarding alerts step and the design handoff (set-data.js).
const GROUPS: AlertGroup[] = [
  {
    label: "תקציב וקטגוריות",
    rows: [
      { key: "cat80", emoji: "🟡", title: "קטגוריה מגיעה ל-80%", sub: "ניידע אתכם כשנשאר עוד מעט בקטגוריה" },
      { key: "cat100", emoji: "🔴", title: "חריגה מעבר ל-100%", sub: "התראה כשקטגוריה עברה את התקציב" },
      { key: "unusual", emoji: "👀", title: "הוצאה חריגה", sub: "סכום שלא אופייני לקטגוריה אצלכם" },
    ],
  },
  {
    label: "חשבונות קבועים",
    rows: [{ key: "billUp", emoji: "📈", title: "חשבון קבוע שעלה", sub: "רק אם עלה ביותר מ-10% וגם לפחות 30 ₪" }],
  },
  {
    label: "סיכומים תקופתיים",
    rows: [
      { key: "monthly", emoji: "🗓️", title: "סיכום חודשי", sub: "תזכורת לסגירת חודש + תמונת מצב" },
      { key: "weekly", emoji: "📊", title: "סיכום שבועי", sub: "טעימה קצרה של השבוע - לבחירתכם" },
    ],
  },
];

export const ALERT_KEYS: ReadonlyArray<AlertKey> = GROUPS.flatMap((g) => g.rows.map((r) => r.key));

// Smart defaults when the household has no persisted `alerts` block yet (an older
// baseline written before the alerts step existed). Mirrors the onboarding defaults
// - weekly summary off, everything else on.
const DEFAULT_ALERTS: BaselineAlerts = {
  cat80: true,
  cat100: true,
  billUp: true,
  unusual: true,
  monthly: true,
  weekly: false,
};

function Switch({ on, onToggle, label, disabled }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="switch"
      data-on={on ? "" : undefined}
    >
      <span className="switch-knob" aria-hidden />
    </button>
  );
}

// Shared presentational body: active-count chip + optional save status, the WhatsApp
// channel card, then the three grouped toggle panels.
function EditorBody({
  value,
  onToggle,
  disabled,
  showChannel,
  status,
}: {
  value: BaselineAlerts;
  onToggle: (key: AlertKey, next: boolean) => void;
  disabled?: boolean;
  showChannel: boolean;
  status?: ReactNode;
}) {
  const onCount = ALERT_KEYS.reduce((n, k) => (value[k] ? n + 1 : n), 0);

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <div className="row between" style={{ alignItems: "center", gap: "var(--sp-3)" }}>
        <span className="chip teal">{onCount} פעילות</span>
        <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", minHeight: 24 }}>
          {status}
        </span>
      </div>

      {showChannel && (
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <span aria-hidden style={{ fontSize: 22 }}>💬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>ההתראות נשלחות לוואטסאפ</div>
            <div className="muted" style={{ fontSize: 13 }}>
              לאותו צ׳אט שבו אתם רושמים הוצאות. אין צורך באפליקציה נוספת.
            </div>
          </div>
          <span className="chip sage">● מחובר</span>
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="label" style={{ margin: "0 2px var(--sp-3)" }}>
            {group.label}
          </div>
          <div className="panel" style={{ display: "grid", gap: "var(--sp-2)", padding: "var(--sp-2)" }}>
            {group.rows.map((row) => (
              <div
                key={row.key}
                className="row between"
                style={{ gap: "var(--sp-3)", padding: "var(--sp-3) var(--sp-3)", borderRadius: "var(--r-3)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minWidth: 0 }}>
                  <span aria-hidden style={{ fontSize: 20 }}>{row.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{row.title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{row.sub}</div>
                  </div>
                </div>
                <Switch
                  on={Boolean(value[row.key])}
                  onToggle={() => onToggle(row.key, !value[row.key])}
                  label={row.title}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// SELF-PERSIST wrapper: owns the alert state and persists each toggle immediately.
function SelfPersistEditor({
  householdId,
  initialAlerts,
  disabled,
  showChannel,
}: {
  householdId: string;
  initialAlerts?: BaselineAlerts;
  disabled?: boolean;
  showChannel: boolean;
}) {
  const [alerts, setAlerts] = useState<BaselineAlerts | null>(initialAlerts ?? null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  // Fetch current alerts only when the parent didn't already hand them in.
  useEffect(() => {
    if (initialAlerts !== undefined) return;
    let cancelled = false;
    api
      .currentHousehold()
      .then(({ household }) => {
        if (!cancelled) setAlerts(household.financialBaseline?.alerts ?? DEFAULT_ALERTS);
      })
      .catch(() => {
        if (!cancelled) setError("לא הצלחנו לטעון את ההעדפות. נסו לרענן.");
      });
    return () => {
      cancelled = true;
    };
  }, [initialAlerts]);

  // Auto-hide the transient "נשמר" confirmation a moment after the last save.
  useEffect(() => {
    if (savedAt === 0) return;
    const t = window.setTimeout(() => setSavedAt(0), 1800);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  const handleToggle = (key: AlertKey, next: boolean) => {
    if (!alerts) return;
    const prev = alerts;
    setAlerts({ ...alerts, [key]: next }); // optimistic
    setError(null);
    api
      .updateAlerts(householdId, { [key]: next })
      .then(() => setSavedAt(Date.now()))
      .catch(() => {
        setAlerts(prev); // revert
        setError("לא הצלחנו לשמור. נסו שוב.");
      });
  };

  if (!alerts) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        טוען העדפות...
      </p>
    );
  }

  const status: ReactNode = error ? (
    <span style={{ fontSize: 13, color: "var(--coral-dark)" }}>{error}</span>
  ) : savedAt ? (
    <span className="chip sage">✓ נשמר</span>
  ) : null;

  return <EditorBody value={alerts} onToggle={handleToggle} disabled={disabled} showChannel={showChannel} status={status} />;
}

type CommonProps = {
  disabled?: boolean;
  /** The WhatsApp channel card. Shown in settings; onboarding hides it. */
  showChannel?: boolean;
};

type ControlledProps = CommonProps & {
  value: BaselineAlerts;
  onChange: (next: BaselineAlerts) => void;
  householdId?: undefined;
};

type SelfPersistProps = CommonProps & {
  householdId: string;
  initialAlerts?: BaselineAlerts;
  value?: undefined;
  onChange?: undefined;
};

export type NotificationsEditorProps = ControlledProps | SelfPersistProps;

export function NotificationsEditor(props: NotificationsEditorProps) {
  if (props.householdId !== undefined) {
    return (
      <SelfPersistEditor
        householdId={props.householdId}
        initialAlerts={props.initialAlerts}
        disabled={props.disabled}
        showChannel={props.showChannel ?? true}
      />
    );
  }
  return (
    <EditorBody
      value={props.value}
      onToggle={(key, next) => props.onChange({ ...props.value, [key]: next })}
      disabled={props.disabled}
      showChannel={props.showChannel ?? true}
    />
  );
}
