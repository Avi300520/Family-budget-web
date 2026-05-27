"use client";

/**
 * Iteration 7 — Insights / Weekly Wrapped (deterministic).
 *
 * Standalone /insights route. Renders one InsightCard per server insight in
 * server-provided order. Period toggle: "השבוע" ↔ "השבוע שעבר".
 *
 * Privacy:
 *   - The /api/v1/households/:id/insights/weekly endpoint returns 403 for
 *     limited_member at the server. The AppShell nav also hides the link for
 *     limited_member. We short-circuit client-side too so a limited_member
 *     who navigates directly to /insights sees a friendly Hebrew message
 *     without ever issuing a 403'd fetch.
 *   - listMembers is only called for owner/admin/adult_member so the colour
 *     map for the top_member card is available.
 */

import { useEffect, useMemo, useState } from "react";
import type {
  HouseholdMember,
  WeeklyInsight,
  WeeklyInsightsResponse
} from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { InsightCard } from "../../components/InsightCard";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import type { MemberColorKey } from "../../styles/tokens";

type MemberLite = HouseholdMember & { displayName?: string; phoneE164?: string };

export default function InsightsPage() {
  const [week, setWeek] = useState<"current" | "last">("current");
  const [data, setData] = useState<WeeklyInsightsResponse>();
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [isLimited, setIsLimited] = useState<boolean>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(undefined);
      setData(undefined);
      try {
        const me = await api.me();
        if (cancelled) return;
        if (!me.household) {
          setError("אין בית מחובר. השלימו את ההצטרפות לפני שתוכלו לראות תובנות.");
          return;
        }
        const limited = me.membership?.role === "limited_member";
        setIsLimited(limited);
        if (limited) return; // do not fetch — server would 403 anyway

        const [insightsRes, membersRes] = await Promise.all([
          api.weeklyInsights(me.household.id, week),
          api.listMembers(me.household.id).catch(() => ({ members: [] as MemberLite[] }))
        ]);
        if (cancelled) return;
        setData(insightsRes);
        setMembers(membersRes.members);
      } catch (e) {
        if (cancelled) return;
        setError("לא הצלחנו לטעון את התובנות. נסו לרענן.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [week]);

  const memberById = useMemo(() => {
    const map = new Map<string, MemberLite>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "var(--sp-5)", maxWidth: 720 }}>
        <header style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h1 className="h1">תובנות השבוע ✨</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            סיכום אוטומטי של הפעילות שלכם, מבוסס על ההוצאות והקטגוריות שכבר תיעדנו.
          </div>
        </header>

        {isLimited ? (
          <section className="panel" style={{ padding: "var(--sp-5)" }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--sp-2)" }}>
              התובנות זמינות לחברי הבית הבוגרים
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              דברו עם בעל/ת הבית — הם יוכלו לשתף איתכם את עיקרי השבוע.
            </div>
          </section>
        ) : (
          <>
            <WeekToggle week={week} onChange={setWeek} />

            {error ? (
              <LoadState error={error} />
            ) : !data ? (
              <LoadState />
            ) : (
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                {data.insights.map((ins, idx) => (
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
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function WeekToggle({
  week,
  onChange
}: {
  week: "current" | "last";
  onChange: (w: "current" | "last") => void;
}) {
  return (
    <div
      role="group"
      aria-label="טווח השבוע"
      style={{ display: "flex", gap: "var(--sp-2)" }}
    >
      <button
        type="button"
        className={`button ${week === "current" ? "" : "secondary"}`}
        onClick={() => onChange("current")}
        aria-pressed={week === "current"}
      >
        השבוע
      </button>
      <button
        type="button"
        className={`button ${week === "last" ? "" : "secondary"}`}
        onClick={() => onChange("last")}
        aria-pressed={week === "last"}
      >
        השבוע שעבר
      </button>
    </div>
  );
}
