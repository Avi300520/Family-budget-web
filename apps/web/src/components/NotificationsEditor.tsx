"use client";

import type { BaselineAlerts } from "@shopping-assistant/shared-types";

// Presentational notification-preferences editor. ONE source of truth for the
// alert toggles, mounted both in /settings/notifications and (later) as the final
// onboarding step. It owns no data — the parent passes the current `BaselineAlerts`
// and an `onChange(key, next)` callback. RTL Hebrew; immediate (no save bar).

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

export function NotificationsEditor({
  value,
  onChange,
  disabled = false,
  showChannel = true,
}: {
  value: BaselineAlerts;
  onChange: (key: AlertKey, next: boolean) => void;
  disabled?: boolean;
  /** The WhatsApp channel card. Shown in settings; the onboarding step may hide it. */
  showChannel?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
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
                  onToggle={() => onChange(row.key, !value[row.key])}
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
