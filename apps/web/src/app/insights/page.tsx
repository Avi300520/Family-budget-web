"use client";

/**
 * תובנות וניתוח — merged Insights + Analysis (redesign §I).
 *
 * Replaces the two pre-merge screens (the weekly-wrapped /insights and the
 * /family/pulse analysis charts). One screen, one period selector
 * (השבוע / החודש / החודש שעבר), two tabs (סיכום / ניתוח).
 *
 * Period → real backend periods (no fake periods):
 *   week      → weeklyInsights("current")    + spending(period="week")    + by-weekday trend
 *   month     → monthlyInsights("current")   + spending(period="month")   + weeks-of-month trend
 *   prevMonth → monthlyInsights("previous")  + spending(period="prevMonth")+ weeks-of-month trend
 * The 14-day activity heatmap is period-independent.
 *
 * Privacy: every endpoint here 403s limited_member server-side AND the nav hides
 * the link; we also short-circuit client-side so a limited_member who navigates
 * directly issues no 403'd fetch and sees a friendly Hebrew message.
 */

import { useEffect, useMemo, useState } from "react";
import type {
  HouseholdMember,
  SpendingByMemberEntry,
  SpendingByWeekdayEntry,
  SpendingPeriod,
  WeeklyInsight
} from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { InsightCard } from "../../components/InsightCard";
import { LoadState } from "../../components/LoadState";
import {
  ActivityHeatmap,
  BarsChart,
  type BarsDatum,
  type HeatmapMember
} from "../../components/charts";
import { colorFor } from "../../styles/members";
import { api } from "../../lib/api";
import type { MemberColorKey } from "../../styles/tokens";

type MemberLite = HouseholdMember & { displayName?: string; phoneE164?: string };
type Trend = { unit: string; data: BarsDatum[] };

const DAYS = 14;
const PERIODS: { id: SpendingPeriod; label: string }[] = [
  { id: "week", label: "השבוע" },
  { id: "month", label: "החודש" },
  { id: "prevMonth", label: "החודש שעבר" }
];

export default function InsightsPage() {
  const [period, setPeriod] = useState<SpendingPeriod>("week");
  const [tab, setTab] = useState<"summary" | "analysis">("summary");

  const [insights, setInsights] = useState<WeeklyInsight[]>([]);
  const [memberSpend, setMemberSpend] = useState<SpendingByMemberEntry[]>([]);
  const [trend, setTrend] = useState<Trend>({ unit: "", data: [] });
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapMember[]>([]);

  const [isLimited, setIsLimited] = useState<boolean>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(undefined);
      setLoading(true);
      try {
        const me = await api.me();
        if (cancelled) return;
        if (!me.household) {
          setError("אין בית מחובר. השלימו את ההצטרפות לפני שתוכלו לראות תובנות.");
          setLoading(false);
          return;
        }
        const limited = me.membership?.role === "limited_member";
        setIsLimited(limited);
        if (limited) {
          setLoading(false);
          return;
        }
        const hid = me.household.id;

        const membersP = api.listMembers(hid).catch(() => ({ members: [] as MemberLite[] }));
        const heatmapP = api.memberActivityHeatmap(hid, DAYS).catch(() => null);
        const memberSpendP = api
          .spendingByMember(hid, period)
          .catch(() => ({ entries: [] as SpendingByMemberEntry[], periodStart: "", periodEnd: "" }));

        let insightsP: Promise<WeeklyInsight[]>;
        let trendP: Promise<Trend>;
        if (period === "week") {
          insightsP = api.weeklyInsights(hid, "current").then((r) => r.insights).catch(() => []);
          trendP = api
            .spendingByWeekday(hid, "week")
            .then((r) => ({ unit: "לפי יום", data: r.entries.map(weekdayBar) }))
            .catch(() => ({ unit: "לפי יום", data: [] }));
        } else {
          const month = period === "month" ? "current" : "previous";
          const minsP = api.monthlyInsights(hid, month);
          insightsP = minsP.then((r) => r.insights).catch(() => []);
          trendP = minsP
            .then((r) => ({
              unit: "לפי שבוע",
              data: r.weeksTrend.map((w) => ({
                label: w.weekLabelHe,
                value: w.amount,
                valueLabel: `₪${w.amount.toLocaleString("he-IL")}`,
                highlight: w.amount > 0
              }))
            }))
            .catch(() => ({ unit: "לפי שבוע", data: [] }));
        }

        const [membersRes, heatmapRes, memberSpendRes, insightsRes, trendRes] = await Promise.all([
          membersP,
          heatmapP,
          memberSpendP,
          insightsP,
          trendP
        ]);
        if (cancelled) return;
        setMembers(membersRes.members);
        setHeatmap(
          (heatmapRes?.rows ?? []).map((row) => ({
            userId: row.userId,
            displayName: row.displayName,
            color: colorFor(row.userId, row.color as MemberColorKey | null | undefined),
            counts: row.days.map((d) => d.count)
          }))
        );
        setMemberSpend(memberSpendRes.entries);
        setInsights(insightsRes);
        setTrend(trendRes);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("לא הצלחנו לטעון את התובנות. נסו לרענן.");
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const memberById = useMemo(() => {
    const map = new Map<string, MemberLite>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  const pLabel = PERIODS.find((p) => p.id === period)?.label ?? "";
  const memberBars: BarsDatum[] = memberSpend.map((e) => ({
    label: firstWord(e.displayName),
    value: e.amount,
    valueLabel: `₪${e.amount.toLocaleString("he-IL")}`,
    highlight: e.amount > 0
  }));

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-5)", maxWidth: 1080 }}>
        <header style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h1 className="h1">תובנות וניתוח</h1>
          <div className="muted" style={{ fontSize: 14 }}>
            סיכום אוטומטי של הפעילות שלכם, ופירוק לפי חבר, זמן וקטגוריה.
          </div>
        </header>

        {isLimited ? (
          <section className="panel" style={{ padding: "var(--sp-5)" }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--sp-2)" }}>
              התובנות זמינות לחברי הבית הבוגרים
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              דברו עם בעל/ת הבית - הם יוכלו לשתף איתכם את עיקרי התקופה.
            </div>
          </section>
        ) : (
          <>
            {/* Period selector — the main control. */}
            <div
              role="group"
              aria-label="תקופה"
              style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--cream-1)", width: "fit-content" }}
            >
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  aria-pressed={period === p.id}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: period === p.id ? "var(--teal)" : "transparent",
                    color: period === p.id ? "#fff" : "var(--text-2)"
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Tabs. */}
            <div
              role="tablist"
              aria-label="תצוגה"
              style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, background: "var(--cream-1)", width: "fit-content" }}
            >
              {([["summary", "סיכום"], ["analysis", "ניתוח"]] as const).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: tab === id ? "var(--cream-2)" : "transparent",
                    color: tab === id ? "var(--teal-dark)" : "var(--text-2)",
                    boxShadow: tab === id ? "var(--elev-1)" : "none"
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>

            {error ? (
              <LoadState error={error} />
            ) : loading ? (
              <LoadState />
            ) : tab === "summary" ? (
              insights.length === 0 ? (
                <section className="panel" style={{ padding: "var(--sp-5)", textAlign: "center" }}>
                  <div className="muted" style={{ fontSize: 13 }}>אין עדיין מספיק פעילות לתובנות בתקופה הזו.</div>
                </section>
              ) : (
                <div className="grid two">
                  {insights.map((ins, idx) => (
                    <InsightCard
                      key={`${ins.kind}-${idx}`}
                      insight={ins}
                      memberDisplayName={
                        ins.kind === "top_member" && ins.memberId
                          ? memberById.get(ins.memberId)?.displayName
                          : undefined
                      }
                      memberColor={
                        ins.kind === "top_member" && ins.memberId
                          ? (memberById.get(ins.memberId)?.color as MemberColorKey | undefined) ?? null
                          : null
                      }
                    />
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "grid", gap: "var(--sp-4)" }}>
                <section className="card" style={{ padding: "var(--sp-5)" }}>
                  <h2 className="h3" style={{ marginBottom: "var(--sp-4)" }}>הוצאות לפי חבר - {pLabel}</h2>
                  {memberBars.length === 0 || memberBars.every((d) => d.value === 0) ? (
                    <EmptyChart />
                  ) : (
                    <BarsChart data={memberBars} height={120} color="var(--teal)" ariaLabel="הוצאות לפי חבר משפחה" />
                  )}
                </section>

                <section className="card" style={{ padding: "var(--sp-5)" }}>
                  <h2 className="h3" style={{ marginBottom: "var(--sp-4)" }}>הוצאות {trend.unit} - {pLabel}</h2>
                  {trend.data.length === 0 || trend.data.every((d) => d.value === 0) ? (
                    <EmptyChart />
                  ) : (
                    <BarsChart data={trend.data} height={120} color="var(--coral)" ariaLabel="מגמת הוצאות בתקופה" />
                  )}
                </section>

                <section className="card" style={{ padding: "var(--sp-5)" }}>
                  <h2 className="h3" style={{ marginBottom: "var(--sp-1)" }}>רמת פעילות - 14 הימים האחרונים</h2>
                  <div className="muted" style={{ fontSize: 12, marginBottom: "var(--sp-4)" }}>
                    כמה קניות נרשמו בכל יום (ללא הוצאות אישיות).
                  </div>
                  {heatmap.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ActivityHeatmap members={heatmap} days={DAYS} />
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyChart() {
  return (
    <div className="muted" style={{ fontSize: 13, padding: "var(--sp-4) 0", textAlign: "center" }}>
      אין עדיין נתונים בתקופה הזו.
    </div>
  );
}

function weekdayBar(e: SpendingByWeekdayEntry): BarsDatum {
  return {
    label: shortDayLabel(e.labelHe),
    value: e.amount,
    valueLabel: `₪${e.amount.toLocaleString("he-IL")}`,
    highlight: e.amount > 0
  };
}

/** First word of a display name, for compact bar labels. */
function firstWord(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** Abbreviates a Hebrew weekday label to 2 chars for compact display. */
function shortDayLabel(labelHe: string): string {
  const map: Record<string, string> = {
    "ראשון": "א׳",
    "שני": "ב׳",
    "שלישי": "ג׳",
    "רביעי": "ד׳",
    "חמישי": "ה׳",
    "שישי": "ו׳",
    "שבת": "ש׳"
  };
  return map[labelHe] ?? labelHe.slice(0, 2);
}
