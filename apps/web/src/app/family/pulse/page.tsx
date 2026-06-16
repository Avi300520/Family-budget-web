"use client";

/**
 * Iteration 9 — /family/pulse (DashboardB).
 *
 * Owner/admin/adult_member ONLY. The server returns 403 on all three
 * endpoints for limited_member, and the AppShell nav hides the link for
 * them. We also short-circuit client-side so a limited_member who
 * navigates directly here sees a friendly Hebrew message without issuing
 * any 403'd fetches.
 *
 * Three panels:
 *   1. Member Spend Bars — this-period spend per household member.
 *   2. Weekday Spend Bars — total spend by day of week (current period).
 *   3. Activity Heatmap — per-member, per-day purchase counts for the
 *      last 14 days (confirmed household purchases only).
 *
 * All data is deterministic — no LLM in any data path.
 * DashboardA at /dashboard is untouched.
 */

import { useEffect, useState } from "react";
import type {
  MemberActivityHeatmapResponse,
  SpendingByMemberEntry,
  SpendingByWeekdayEntry
} from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import {
  ActivityHeatmap,
  BarsChart,
  type BarsDatum,
  type HeatmapMember
} from "../../../components/charts";
import { colorFor } from "../../../styles/members";
import { api } from "../../../lib/api";
import type { MemberColorKey } from "../../../styles/tokens";

const DAYS = 14;

export default function FamilyPulsePage() {
  const [memberSpend, setMemberSpend] = useState<SpendingByMemberEntry[]>();
  const [weekdaySpend, setWeekdaySpend] = useState<SpendingByWeekdayEntry[]>();
  const [heatmap, setHeatmap] = useState<MemberActivityHeatmapResponse>();
  const [isLimited, setIsLimited] = useState<boolean>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(undefined);
      try {
        const me = await api.me();
        if (cancelled) return;
        if (!me.household) {
          setError("אין בית מחובר.");
          return;
        }
        const limited = me.membership?.role === "limited_member";
        setIsLimited(limited);
        if (limited) return; // server would 403 anyway

        const [memberRes, weekdayRes, heatmapRes] = await Promise.all([
          api.spendingByMember(me.household.id).catch(() => ({ entries: [] as SpendingByMemberEntry[], periodStart: "", periodEnd: "" })),
          api.spendingByWeekday(me.household.id).catch(() => ({ entries: [] as SpendingByWeekdayEntry[], periodStart: "", periodEnd: "" })),
          api.memberActivityHeatmap(me.household.id, DAYS).catch(() => null)
        ]);
        if (cancelled) return;
        setMemberSpend(memberRes.entries);
        setWeekdaySpend(weekdayRes.entries);
        setHeatmap(heatmapRes ?? undefined);
      } catch {
        if (cancelled) return;
        setError("לא הצלחנו לטעון את הנתונים. נסו לרענן.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Member spend → BarsChart data ───────────────────────────────────────────
  const memberBarsData: BarsDatum[] = (memberSpend ?? []).map((e) => ({
    label: firstWord(e.displayName),
    value: e.amount,
    valueLabel: `₪${e.amount.toLocaleString("he-IL")}`,
    highlight: e.amount > 0
  }));

  // ── Weekday spend → BarsChart data ──────────────────────────────────────────
  // weekday entries come sorted weekday 0-6 from the server.
  const weekdayBarsData: BarsDatum[] = (weekdaySpend ?? []).map((e) => ({
    label: shortDayLabel(e.labelHe),
    value: e.amount,
    valueLabel: `₪${e.amount.toLocaleString("he-IL")}`,
    highlight: e.amount > 0
  }));

  // ── Heatmap data ─────────────────────────────────────────────────────────────
  const heatmapMembers: HeatmapMember[] = (heatmap?.rows ?? []).map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    color: colorFor(row.userId, row.color as MemberColorKey | null | undefined),
    counts: row.days.map((d) => d.count)
  }));

  const loading = memberSpend === undefined && weekdaySpend === undefined && heatmap === undefined && isLimited === undefined;

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-5)", maxWidth: 780 }}>
        <header style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h1 className="h1">ניתוח המשפחה 📊</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            הוצאות לפי חבר, יום בשבוע, ופעילות יומית.
          </div>
        </header>

        {isLimited === true ? (
          <section className="panel" style={{ padding: "var(--sp-5)" }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--sp-2)" }}>
              הדף הזה זמין רק לבעלים, מנהלים וחברים בוגרים
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              הדשבורד האישי שלך נמצא בדף הבית.
            </div>
          </section>
        ) : error ? (
          <LoadState error={error} />
        ) : loading ? (
          <LoadState />
        ) : (
          <div style={{ display: "grid", gap: "var(--sp-4)" }}>

            {/* ── Panel 1: Member Spend ──────────────────────────────── */}
            <section className="card" style={{ padding: "var(--sp-5)" }}>
              <h2 className="h3" style={{ marginBottom: "var(--sp-4)" }}>
                הוצאות לפי חבר — החודש
              </h2>
              {memberBarsData.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, padding: "var(--sp-4) 0", textAlign: "center" }}>
                  אין עדיין הוצאות החודש.
                </div>
              ) : (
                <BarsChart
                  data={memberBarsData}
                  height={120}
                  color="var(--teal)"
                  ariaLabel="הוצאות לפי חבר משפחה"
                />
              )}
            </section>

            {/* ── Panel 2: Weekday Spend ─────────────────────────────── */}
            <section className="card" style={{ padding: "var(--sp-5)" }}>
              <h2 className="h3" style={{ marginBottom: "var(--sp-4)" }}>
                הוצאות לפי יום — החודש
              </h2>
              {weekdayBarsData.every((d) => d.value === 0) ? (
                <div className="muted" style={{ fontSize: 13, padding: "var(--sp-4) 0", textAlign: "center" }}>
                  אין עדיין הוצאות החודש.
                </div>
              ) : (
                <BarsChart
                  data={weekdayBarsData}
                  height={120}
                  color="var(--coral)"
                  ariaLabel="הוצאות לפי יום בשבוע"
                />
              )}
            </section>

            {/* ── Panel 3: Activity Heatmap ──────────────────────────── */}
            <section className="card" style={{ padding: "var(--sp-5)" }}>
              <h2 className="h3" style={{ marginBottom: "var(--sp-1)" }}>
                רמזור פעילות — 14 הימים האחרונים
              </h2>
              <div className="muted" style={{ fontSize: 12, marginBottom: "var(--sp-4)" }}>
                כמה קניות עשה כל חבר בכל יום (ללא הוצאות אישיות).
              </div>
              {heatmapMembers.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, padding: "var(--sp-4) 0", textAlign: "center" }}>
                  אין עדיין נתוני פעילות.
                </div>
              ) : (
                <ActivityHeatmap
                  members={heatmapMembers}
                  days={DAYS}
                />
              )}
            </section>

          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Returns the first word of a display name for compact bar labels. */
function firstWord(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** Abbreviates a Hebrew weekday label to 2 chars for compact display. */
function shortDayLabel(labelHe: string): string {
  // "ראשון" → "א׳", "שני" → "ב׳", etc.
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
