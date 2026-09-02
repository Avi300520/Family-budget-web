"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  ActivityEntry,
  BudgetCurrent,
  CategoryBudget,
  Household,
  HouseholdMember,
  ProjectBudget,
  SpendingByCategoryEntry,
  User,
  WeeklyInsightsResponse,
  SeparateAccountsFinancialCycle,
  PurchaseUnallocatedReason,
} from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { InsightCard } from "../../components/InsightCard";
import { Avatar } from "../../components/Avatar";
import { LoadState } from "../../components/LoadState";
import { WhatsAppCtaBanner } from "../../components/WhatsAppCta";
import { WishlistPanel } from "../../components/WishlistPanel";
import { Donut } from "../../components/charts";
import { api } from "../../lib/api";
import { heDate, ilsFromAgorot } from "../../lib/format";
import { SEPACCT_UI_ENABLED } from "../../lib/sepacct";
import { sepacct } from "../../lib/sepacctApi";
import { shouldShowSeparateAccountsCard, uniformViewerPercentage } from "../../lib/sepacctView";
import { redirectIfUnauthorized } from "../../lib/authGuard";
import { requiresOnboarding } from "../../lib/authRouting";
import { selectInsightPreview } from "../../lib/insightsPreview";

// ── Category display definitions (no spend data — Iteration 5 will wire real data) ──
const CATEGORIES: ReadonlyArray<{ key: string; label: string; color: string }> = [
  { key: "supermarket",       label: "קניות לבית",      color: "var(--teal)"    },
  { key: "pharmacy_health",   label: "פארם ובריאות",    color: "var(--ocean)"   },
  { key: "restaurants_cafes", label: "מסעדות וקפה",     color: "var(--coral)"   },
  { key: "fuel_transport",    label: "דלק ותחבורה",     color: "var(--mustard)" },
  { key: "kids",              label: "ילדים",            color: "var(--sage)"    },
  { key: "entertainment",     label: "בילוי",            color: "var(--plum)"    },
  { key: "other",             label: "אחר",              color: "var(--berry)"   },
] as const;

// Deterministic color for project cards (derived from project id)
const PROJECT_COLORS = [
  "var(--teal)",
  "var(--coral)",
  "var(--plum)",
  "var(--mustard)",
  "var(--ocean)",
  "var(--sage)",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstName(name?: string): string {
  if (!name) return "";
  return name.split(/\s+/)[0] ?? name;
}

function dateLabel(iso: string): string {
  const parts = iso.split("-");
  const mm = parts[1] ?? "";
  const dd = parts[2] ?? "";
  return `${dd}.${mm}.`;
}

function periodDays(budget: BudgetCurrent): { totalDays: number; daysIn: number } {
  const start = new Date(budget.periodStart);
  const end = new Date(budget.periodEnd);
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysIn = Math.max(0, totalDays - budget.daysRemaining);
  return { totalDays, daysIn };
}

function projectColor(id: string): string {
  const idx =
    Math.abs(id.charCodeAt(0) + (id.charCodeAt(id.length - 1) ?? 0)) %
    PROJECT_COLORS.length;
  return PROJECT_COLORS[idx] ?? "var(--teal)";
}

function burnRatePill(status: string): { label: string; good: boolean } {
  const map: Record<string, { label: string; good: boolean }> = {
    on_track:      { label: "בקצב טוב",         good: true  },
    slightly_high: { label: "מעט מעל הקצב",     good: false },
    high_risk:     { label: "סיכון גבוה",        good: false },
    exceeded:      { label: "חרגנו",             good: false },
  };
  return map[status] ?? { label: status, good: false };
}

// ── MonthProgress ─────────────────────────────────────────────────────────────
function MonthProgress({ budget }: { budget: BudgetCurrent }) {
  const { totalDays, daysIn } = periodDays(budget);
  const usedPct =
    budget.budgetAmount > 0 ? budget.spentAmount / budget.budgetAmount : 0;
  const elapsedPct = daysIn / totalDays;
  const { label: pillLabel, good: isGood } = burnRatePill(budget.burnRateStatus);
  const usedPctClamped = Math.min(1, Math.max(0, usedPct));

  return (
    <div
      style={{
        borderRadius: "var(--r-5)",
        padding: "var(--sp-8)",
        background: "linear-gradient(135deg, var(--teal-dark) 0%, var(--teal) 100%)",
        color: "white",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* decorative concentric rings */}
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        style={{ position: "absolute", insetInlineEnd: -40, top: -30, opacity: 0.1 }}
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="1.5" fill="none" />
        <circle cx="100" cy="100" r="60" stroke="white" strokeWidth="1.5" fill="none" />
        <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>

      {/* date row */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          opacity: 0.82,
          marginBottom: "var(--sp-4)",
          position: "relative",
          zIndex: 1,
        }}
      >
        יום <span className="mono">{daysIn}</span> מתוך{" "}
        <span className="mono">{totalDays}</span>
      </div>

      {/* main row: amount + status pill */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--sp-5)",
          flexWrap: "wrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <div style={{ fontSize: 13, opacity: 0.82, marginBottom: "var(--sp-2)" }}>
            הוצאתם החודש
          </div>
          <div
            className="mono"
            style={{
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            ₪{budget.spentAmount.toLocaleString("he-IL")}
          </div>
          <div style={{ marginTop: "var(--sp-2)", fontSize: 13, opacity: 0.82 }}>
            מתוך תקציב של{" "}
            <span className="mono" style={{ fontWeight: 600 }}>
              ₪{budget.budgetAmount.toLocaleString("he-IL")}
            </span>
            {" • "}נשארו{" "}
            <span className="mono" style={{ fontWeight: 600 }}>
              ₪{budget.remainingAmount.toLocaleString("he-IL")}
            </span>
          </div>
        </div>

        {/* status pill */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            padding: "8px 14px",
            borderRadius: 999,
            background: isGood
              ? "color-mix(in srgb, white 18%, transparent)"
              : "color-mix(in srgb, var(--coral) 85%, transparent)",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
            alignSelf: "flex-start",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: isGood
                ? "color-mix(in srgb, var(--pos) 30%, white)"
                : "var(--coral-soft)",
              flexShrink: 0,
            }}
          />
          {pillLabel}
        </span>
      </div>

      {/* dual progress bar */}
      <div style={{ marginTop: "var(--sp-6)", position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            marginBottom: 6,
            opacity: 0.82,
          }}
        >
          <span>הוצאה / תקציב</span>
          <span className="mono">{Math.round(usedPct * 100)}%</span>
        </div>
        <div
          style={{
            height: 8,
            background: "color-mix(in srgb, white 18%, transparent)",
            borderRadius: 999,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* spend fill */}
          <div
            style={{
              width: `${usedPctClamped * 100}%`,
              height: "100%",
              background: "white",
              borderRadius: 999,
            }}
          />
          {/* day-elapsed marker */}
          <div
            style={{
              position: "absolute",
              insetInlineStart: `${elapsedPct * 100}%`,
              top: -3,
              bottom: -3,
              width: 2,
              background: "color-mix(in srgb, white 70%, transparent)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            marginTop: 4,
            // a11y 1.4.3: opacity composited this 10px white label toward the teal
            // hero. The row is already secondary by size and position; the
            // transparency was the only thing pushing it under the AA floor.
          }}
        >
          <span className="mono">{dateLabel(budget.periodStart)}</span>
          <span>היום</span>
          <span className="mono">{dateLabel(budget.periodEnd)}</span>
        </div>
      </div>
    </div>
  );
}

// ── PendingApprovals ──────────────────────────────────────────────────────────
// Empty state — no admin-side list endpoint yet.
// Iteration 5 will add: GET /api/v1/households/:id/pending-approvals
function PendingApprovals({ role }: { role: string | undefined }) {
  if (role !== "owner" && role !== "admin") return null;
  return (
    <section
      style={{
        background: "var(--coral-bg)",
        border: "1px solid var(--coral-soft)",
        borderRadius: "var(--r-4)",
        padding: "var(--sp-5)",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
      }}
      aria-label="בקשות ממתינות לאישור"
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "var(--coral-soft)",
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        🔔
      </div>
      <div>
        <h2 className="h4">בקשות ממתינות לאישור</h2>
        <div className="muted" style={{ fontSize: 13, marginTop: "var(--sp-1)" }}>
          בקשות מחברי הבית יופיעו כאן כשתהיינה בקשות ממתינות.
        </div>
      </div>
    </section>
  );
}

// ── ProjectsStrip ─────────────────────────────────────────────────────────────
// Per-project EXPENSE tracking (redesign §H): label "הוצא", spent/budget from the
// ProjectBudget.spent field (all-time confirmed project spend). Not savings.
function ProjectsStrip({ projects }: { projects: ProjectBudget[] }) {
  const visible = projects.slice(0, 3);

  return (
    <section className="card" style={{ padding: "var(--sp-6)" }}>
      <div className="row between" style={{ marginBottom: "var(--sp-5)" }}>
        <div>
          <h2 className="h3">פרויקטים פעילים</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: "var(--sp-1)" }}>
            מעקב הוצאות לכל פרויקט
          </div>
        </div>
        <Link className="btn sm ghost" href="/budget" style={{ textDecoration: "none" }}>
          נהל
        </Link>
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "var(--sp-10) 0",
            gap: "var(--sp-3)",
          }}
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">🏗️</span>
          <span style={{ fontWeight: 500, color: "var(--text-1)" }}>אין פרויקטים פתוחים</span>
          <span className="muted" style={{ fontSize: 13 }}>
            אפשר להתחיל: &quot;פתח פרויקט לחופשת קיץ&quot;
          </span>
          <Link
            className="button"
            href="/budget"
            style={{ textDecoration: "none", marginTop: "var(--sp-2)" }}
          >
            + פרויקט חדש
          </Link>
        </div>
      ) : (
        <div className="grid three">
          {visible.map((p) => {
            const color = projectColor(p.id);
            // 1.3.1: `new Date(endDate + "T00:00:00")` rendered the literal
            // "יעד: Invalid Date" whenever endDate was not a bare YYYY-MM-DD.
            // heDate() returns null instead of garbage, and the row is dropped.
            const targetHe = heDate(p.endDate);
            return (
              <Link
                key={p.id}
                href={`/budget/project/${p.id}`}
                style={{
                  padding: "var(--sp-4)",
                  borderRadius: "var(--r-3)",
                  background: "var(--cream-1)",
                  border: "1px solid var(--cream-3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--sp-3)",
                  textDecoration: "none",
                  color: "inherit",
                  boxShadow: "var(--elev-1)",
                }}
              >
                {/* project header */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--r-2)",
                      background: "var(--teal-bg)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                      flexShrink: 0,
                      color,
                    }}
                    aria-hidden="true"
                  >
                    📁
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </div>
                    {targetHe && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        יעד: {targetHe}
                      </div>
                    )}
                  </div>
                </div>

                {/* spent / budget — per-project expense tracking ("הוצא") */}
                {(() => {
                  const spent = p.spent ?? 0;
                  const pct = p.totalAmount > 0 ? Math.min(100, (spent / p.totalAmount) * 100) : 0;
                  const over = spent > p.totalAmount;
                  return (
                    <div>
                      <div className="row between" style={{ marginBottom: "var(--sp-1)" }}>
                        <span className="label">הוצא</span>
                        <span
                          className="mono"
                          style={{ fontSize: 13, fontWeight: 700, color: over ? "var(--coral-dark)" : color }}
                        >
                          ₪{spent.toLocaleString("he-IL")} / ₪{p.totalAmount.toLocaleString("he-IL")}
                        </span>
                      </div>
                      <div className="bar" aria-hidden>
                        <i style={{ width: `${pct}%`, background: over ? "var(--coral)" : color }} />
                      </div>
                    </div>
                  );
                })()}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── CategoriesPanel (Iteration 5 — wired to real spending) ────────────────────
// Real spend numbers from GET /api/v1/households/:id/spending/by-category.
// Donut segments are sized proportionally to the actual ILS amount per
// category. Categories with zero spend are listed below the donut at low
// opacity (taxonomy reference) but excluded from the donut to avoid a
// misleading "equal-weight" visual.
function CategoriesPanel({
  spending,
  categoryBudgets,
}: {
  spending: SpendingByCategoryEntry[] | undefined;
  categoryBudgets: CategoryBudget[] | undefined;
}) {
  // Total spend across all categories, used to decide empty-vs-data state.
  const totalSpent = spending?.reduce((sum, s) => sum + s.spent, 0) ?? 0;
  const hasData = spending && totalSpent > 0;

  // Build donut segments only from categories with positive spend, preserving
  // the canonical CATEGORIES order so colours are stable across renders.
  const spentByKey = new Map<string, number>(
    (spending ?? []).map((s) => [s.category, s.spent])
  );
  // Iteration 10 — per-category monthly caps. When a category has a cap we
  // render a spent/cap progress bar in its legend row. Categories without a cap
  // render exactly as before (the map is empty → zero visual change).
  const capByKey = new Map<string, number>(
    (categoryBudgets ?? []).map((b) => [b.category, b.monthlyLimit])
  );
  const segments = CATEGORIES
    .map((c) => ({ key: c.key, label: c.label, color: c.color, spent: spentByKey.get(c.key) ?? 0 }))
    .filter((s) => s.spent > 0)
    .map((s) => ({ value: s.spent, color: s.color, label: s.label }));

  return (
    <section className="card" style={{ padding: "var(--sp-6)" }}>
      <div className="row between" style={{ marginBottom: "var(--sp-5)" }}>
        <div>
          <h2 className="h3">קטגוריות</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: "var(--sp-1)" }}>
            {hasData
              ? `סה"כ ${totalSpent.toLocaleString()} ש"ח החודש`
              : "כמה הולך לאן"}
          </div>
        </div>
        <Link
          href="/dashboard/spending"
          className="btn sm ghost"
          style={{ textDecoration: "none" }}
        >
          פירוט
        </Link>
      </div>

      {hasData ? (
        <div
          style={{
            display: "flex",
            gap: "var(--sp-6)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Donut
            size={160}
            thickness={20}
            segments={segments}
            ariaLabel="התפלגות הוצאות לפי קטגוריה"
          />
          <div style={{ flex: 1, minWidth: 140, display: "grid", gap: "var(--sp-3)" }}>
            {CATEGORIES.map((c) => {
              const spent = spentByKey.get(c.key) ?? 0;
              const cap = capByKey.get(c.key);
              const hasCap = cap !== undefined && cap > 0;
              // A row is "active" (full opacity) if it has spend OR a cap set.
              const isActive = spent > 0 || hasCap;
              // Progress fills toward the cap; the bar visually caps at 100%
              // even when overspent, but the numeric text shows the real spent.
              const pct = hasCap ? (spent / cap!) * 100 : 0;
              const fillClass = pct >= 90 ? " rose" : pct >= 70 ? " amber" : "";
              return (
                <div
                  key={c.key}
                  style={{
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: c.color,
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0.4,
                      }}
                    />
                    {/* a11y 1.4.3: the inactive (taxonomy-reference) rows used to be dimmed
                        with opacity:.4 on the whole row, which composited --text-1 down to
                        about 1.9:1 on the white card. The de-emphasis is now a token step on
                        the text and stays as transparency only on the decorative colour dot. */}
                    <span style={{ flex: 1, fontSize: 13, color: isActive ? "var(--text-1)" : "var(--text-2)" }}>{c.label}</span>
                    {hasCap ? (
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                        {spent.toLocaleString()} / {cap!.toLocaleString()}
                      </span>
                    ) : (
                      isActive && (
                        <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                          {spent.toLocaleString()}
                        </span>
                      )
                    )}
                  </div>
                  {hasCap && (
                    <div className="progress" style={{ height: 6 }}>
                      <div
                        className={`progress-fill${fillClass}`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-8) var(--sp-4)",
            gap: "var(--sp-2)",
            textAlign: "center",
            minHeight: 160,
          }}
        >
          <span style={{ fontSize: 32 }} aria-hidden="true">📊</span>
          <span style={{ fontWeight: 500, color: "var(--text-1)" }}>
            עדיין אין הוצאות החודש
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            כשתרשמו הוצאות, ההתפלגות תופיע כאן.
          </span>
        </div>
      )}
    </section>
  );
}

// ── ActivityFeed (Iteration 5 — wired to real data) ──────────────────────────
// Renders entries from GET /api/v1/households/:id/activity. Avatar coloured by
// actorUserId via the shared colorFor() helper (no Hebrew name → "?" initial).
// "needsApproval" entries get a coral pill so owner/admin can spot them fast.

// Deterministic, no `Intl.RelativeTimeFormat` (locale fragility). Hebrew labels
// for the most common ranges; otherwise fall back to short date.
function timeAgoHe(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "עכשיו";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  // Older than a week → short date (no year for current-year entries).
  const date = new Date(ts);
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function ActivityFeed({ entries, memberColorMap }: { entries: ActivityEntry[] | undefined; memberColorMap?: Map<string, string> }) {
  const isLoading = entries === undefined;
  const hasEntries = !isLoading && entries.length > 0;

  return (
    <section className="card" style={{ padding: "var(--sp-6)" }}>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h2 className="h3">הפעילות שלנו</h2>
        <div className="muted" style={{ fontSize: 13, marginTop: "var(--sp-1)" }}>
          פעולות אחרונות בבית
        </div>
      </div>

      {isLoading ? (
        <div className="muted" style={{ padding: "var(--sp-6) 0", textAlign: "center", fontSize: 13 }}>
          טוען פעילות…
        </div>
      ) : hasEntries ? (
        /* 1.3.1: `list-style:none` drops the list role and `display:flex` on the li
           drops the listitem role in WebKit - the same defect BATCH-GH fixed on /l.
           The explicit roles restore the item count with zero visual change. */
        <ul role="list" style={{ display: "grid", gap: "var(--sp-3)", listStyle: "none", padding: 0, margin: 0 }}>
          {entries.slice(0, 12).map((e, idx) => (
            <li
              key={`${e.ts}-${idx}`}
              role="listitem"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--sp-3)",
                padding: "var(--sp-2) 0",
                borderBottom:
                  idx === Math.min(entries.length, 12) - 1
                    ? "none"
                    // --line-1 is not defined anywhere in tokens.css, so the whole
                    // `border` declaration computed to `initial` and no rule was drawn
                    // between rows.
                    : "1px solid var(--cream-3)",
              }}
            >
              {e.actorUserId ? (
                <Avatar
                  memberId={e.actorUserId}
                  displayName={e.actorName}
                  colorKey={memberColorMap?.get(e.actorUserId)}
                  size="sm"
                  ariaLabel={e.actorName ?? "חבר משפחה"}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    // --surface-2 is not defined; the fallback icon chip had no fill.
                    background: "var(--cream-3)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 13,
                  }}
                >
                  {e.icon ?? "•"}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--text-1)", lineHeight: 1.4 }}>
                  {e.actorName && (
                    <span style={{ fontWeight: 500 }}>{e.actorName} </span>
                  )}
                  <span>{e.detailHe}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {timeAgoHe(e.ts)}
                </div>
              </div>
              {e.needsApproval && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--coral)",
                    // a11y 1.4.3: white on --coral is 3.14:1 and 11px is not large
                    // text, so the pill keeps its coral fill and takes ink text.
                    color: "var(--text-0)",
                    flexShrink: 0,
                  }}
                >
                  ממתין
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-10) var(--sp-4)",
            gap: "var(--sp-3)",
            textAlign: "center",
            minHeight: 200,
          }}
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">💬</span>
          <span style={{ fontWeight: 500, color: "var(--text-1)" }}>
            פעילות תופיע כאן
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            אחרי שתשלחו הודעות ב-WhatsApp,
            <br />
            הפעולות יתאגדו כאן למשפחה.
          </span>
        </div>
      )}
    </section>
  );
}

// ── InsightsStrip — weekly-insights preview ───────────────────────────────────
// Reuses the deployed GET /households/:id/insights/weekly path: shows the first
// 2-3 insights + a link to the full /insights page (fixes the empty placeholder
// while real weekly insights existed). Renders ONLY inside FamilyView (the
// non-limited branch), so household-wide data never reaches a limited_member.
// A fetch error collapses to the friendly empty-state — it never blocks the page.
function InsightsStrip({ householdId }: { householdId: string }) {
  const [data, setData] = useState<WeeklyInsightsResponse>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .weeklyInsights(householdId, "current")
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [householdId]);

  const { cards, isEmpty, emptyHeadlineHe } = selectInsightPreview(data?.insights, 3);
  const showEmpty = failed || (data !== undefined && isEmpty);

  return (
    <section className="card" style={{ padding: "var(--sp-6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-4)" }}>
        <div>
          <h2 className="h3">תובנות</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: "var(--sp-1)" }}>
            מבוסס על ההתנהגות שלכם
          </div>
        </div>
        <Link href="/insights" className="muted" style={{ fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
          לכל התובנות →
        </Link>
      </div>
      {data === undefined && !failed ? (
        <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LoadState />
        </div>
      ) : showEmpty ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-8) var(--sp-4)",
            gap: "var(--sp-3)",
            textAlign: "center",
            minHeight: 180,
          }}
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">🌿</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {emptyHeadlineHe ?? "אחרי כמה פעולות נתחיל להראות לכם דברים מעניינים על הבית."}
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          {cards.map((ins, idx) => (
            <InsightCard key={`${ins.kind}-${idx}`} insight={ins} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── LimitedMemberView ─────────────────────────────────────────────────────────
// Personal budget only — no household data exposed. Business logic preserved from
// before Iteration 3.
function LimitedMemberView({
  budget,
  membership,
}: {
  budget: BudgetCurrent & { mySpentAmount: number; myPersonalSpent: number };
  membership?: HouseholdMember;
}) {
  const limit = membership?.personalBudgetMonthly;
  const hasLimit = typeof limit === "number" && limit > 0;
  const personalSpent = budget.myPersonalSpent;
  const pct = hasLimit
    ? Math.min(100, Math.round((personalSpent / limit) * 100))
    : 0;

  let progressClass = "";
  if (pct >= 100) progressClass = "rose";
  else if (pct >= 75) progressClass = "amber";

  return (
    <>
      <section className="hero-panel">
        <h2>התקציב האישי שלי החודש</h2>
        {hasLimit ? (
          <>
            <div className="hero-metric">
              <span className="mono">{personalSpent.toLocaleString()}</span>
              <span className="denominator"> / {limit.toLocaleString()} ₪</span>
            </div>
            <div className="progress">
              <div
                className={`progress-fill${progressClass ? ` ${progressClass}` : ""}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              נוצלו <span className="mono">{pct}%</span> מהתקציב האישי החודשי
            </div>
            <div className="help-box">
              <div className="help-line">
                📌 הוצאות אישיות - שלח <strong>#אישי</strong> בסוף ההודעה.
              </div>
              <div className="help-line">
                🏠 קניות לבית - נרשמות לתקציב הבית ללא הגבלה.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hero-metric">
              <span className="mono">{personalSpent.toLocaleString()}</span>
              <span className="denominator"> ₪</span>
            </div>
            <div className="muted">סך ההוצאות האישיות שלי החודש</div>
            <div className="help-box">
              <div className="help-line">
                📌 הוצאות אישיות - שלח <strong>#אישי</strong> בסוף ההודעה.
              </div>
            </div>
          </>
        )}
        <div className="muted" style={{ marginTop: 14 }}>
          נשארו <span className="mono">{budget.daysRemaining}</span> ימים במחזור הנוכחי.
        </div>
      </section>

      <div className="quick-actions">
        <Link
          className="button secondary"
          href="/shopping-list"
          style={{ textDecoration: "none" }}
        >
          🛒 רשימת קניות
        </Link>
        <Link
          className="button secondary"
          href="/my-requests"
          style={{ textDecoration: "none" }}
        >
          הבקשות שלי
        </Link>
      </div>

      {/* Iteration 8 — the child's own wishlist. Self-contained: loads
          /wishlist/me, never household data. No mark-fulfilled here. */}
      <div style={{ marginTop: "var(--sp-5)" }}>
        <WishlistPanel />
      </div>
    </>
  );
}

// ── SEPACCT spec screen E — **THE DASHBOARD CARD.** ──────────────────────────────
//
// Deferred from run 18 and correctly: it is a surface over numbers that did not exist until the
// ratio started applying itself. It exists now, so the dashboard — the page an adult opens when
// they open the web app at all — says what this household's arrangement means for them.
//
// ⚠️ **IT IS ABSENT, NEVER EMPTY AND NEVER AN ERROR.** Three independent reasons it does not
// render, and all three are ordinary: the build has no `NEXT_PUBLIC_SEPACCT_UI`, the household has
// not declared (the route answers `404`, deliberately indistinguishable from a missing resource —
// §3), or the request failed. A dashboard is a page of panels; a panel that renders an error
// because an unrelated feature is off is worse than one that is not there.
//
// ⚠️ **`הכסף שלך החודש` IS THE SPEC'S TITLE AND IT IS NOT USED, BECAUSE IT WOULD BE FALSE.**
// `GET …/my-components` takes NO range — its own DTO says so — and returns all-history totals
// bounded only by `windowOpenedAt`. Labelling them "this month" would put a wrong word on a right
// number, which is the failure `A66` was struck for. The window line says what the range really is,
// in the same two shapes `/my-record` uses, so the two pages cannot disagree.
//
// ⚠️ AND `חלקך 0₪` IS NOT RENDERED AS A TILE. `handlers.ts` on its own copy: *"arithmetically
// true and semantically nonsense"*. A household that has declared but split nothing yet gets the
// one number that means something and a way to the page that explains the rest.
const UNALLOCATED_LABELS: Record<PurchaseUnallocatedReason, string> = {
  child_payer: "הוצאות שילדים רשמו נכנסות להוצאות הבית ואינן מתחלקות",
  pending: "היחס מחכה למבוגר/ת נוסף/ת",
  inactive: "החלוקה הייתה כבויה",
  stalled: "יחס החלוקה דרש תיקון",
  missing_payer: "לא נשמר מי שילם",
  ineligible_payer: "המשלם/ת לא היה/תה מבוגר/ת פעיל/ה",
  allocation_failure: "החלוקה לא הושלמה"
};

function MyMoneyCard({ householdId, from, to, personalSpent }: { householdId: string; from: string; to: string; personalSpent: number }) {
  const [totals, setTotals] = useState<SeparateAccountsFinancialCycle>();
  const [hidden, setHidden] = useState(!SEPACCT_UI_ENABLED);

  useEffect(() => {
    if (!SEPACCT_UI_ENABLED) return;
    void sepacct.getFinancialCycle(householdId, from, to)
      .then(setTotals)
      // `404` (undeclared household, or the flag off) and a transient failure are NOT told apart,
      // and deliberately: the distinction matters to a caller that can act on it, and a dashboard
      // panel cannot. Both hide the card, which is the only outcome either one has.
      .catch(() => { setHidden(true); });
  }, [householdId, from, to]);

  if (hidden || !shouldShowSeparateAccountsCard(totals)) return null;

  return (
    <section className="panel" data-sepacct-card="computed-share">
      <h2 style={{ marginTop: 0 }}>הכסף שלך</h2>
      {/* ── F534 `R-2` R2-4 — **TWO TILES IN ONE GRID READ AS PARTS OF EACH OTHER.** A 60/40
          household sees `נרשמו על שמך ₪1,000` beside `החלק שלך ₪900` and reads 90%. The
          real answer is that ₪900 is 60% of a DIFFERENT population — every shared expense in the
          household, not just the ones they recorded. `/my-record` carries exactly this sentence
          and the card, added this run, dropped it. */}
      <p className="muted" style={{ marginTop: 0 }}>מוצגים רכיבים בלבד, כל אחד בפני עצמו. החלק שלך מחושב מכל ההוצאות המשותפות בבית, לא רק מאלה שרשמתם.</p>
      <p className="status">המחזור <bdi dir="ltr">{heDate(totals.from)}</bdi> עד <bdi dir="ltr">{heDate(totals.to)}</bdi>.</p>
      <div className="grid two">
        <div className="panel"><span className="label">נרשמו על שמך</span><strong className="mono" dir="ltr">{ilsFromAgorot(totals.recordedAgorot)}</strong></div>
        <div className="panel"><span className="label">החלק שלך</span><strong className="mono" dir="ltr">{ilsFromAgorot(totals.viewerShareAgorot)}</strong></div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <span className="label">הוצאות אישיות שלך במחזור</span>
        <strong className="mono" dir="ltr">₪{personalSpent.toLocaleString("he-IL")}</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>המספר הזה מוצג רק לך ואינו חלק מהחלוקה ביניכם.</p>
      </div>
      {uniformViewerPercentage(totals) !== null && <p className="muted">האחוז האחיד במחזור: <bdi dir="ltr">{uniformViewerPercentage(totals)}</bdi></p>}
      {totals.unallocated.map((bucket) => <p className="status warn" key={bucket.reason}>{UNALLOCATED_LABELS[bucket.reason]}: <bdi dir="ltr">{ilsFromAgorot(bucket.agorot)}</bdi> ({bucket.count})</p>)}
      {/* The spec's link is "כל ההוצאות המשותפות →". It points at the page these two numbers
          come from, and it is labelled with that page's OWN title so the link and the heading a
          person lands on are the same words. */}
      <p style={{ marginBottom: 0 }}><Link data-action="open-my-record" href="/my-record">מה שנרשם ←</Link></p>
    </section>
  );
}

// ── FamilyView — DashboardA (story-first) ────────────────────────────────────
function FamilyView({
  budget,
  activeProjects,
  role,
  householdId,
  activity,
  spendingByCategory,
  categoryBudgets,
  memberColorMap,
}: {
  budget: BudgetCurrent & { mySpentAmount: number; myPersonalSpent: number };
  activeProjects: ProjectBudget[];
  role: string | undefined;
  householdId: string;
  activity: ActivityEntry[] | undefined;
  spendingByCategory: SpendingByCategoryEntry[] | undefined;
  categoryBudgets: CategoryBudget[] | undefined;
  memberColorMap: Map<string, string>;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      {/* Pending approvals alert (owner/admin only, empty state) */}
      <PendingApprovals role={role} />

      {/* Spec screen E. Inside `FamilyView`, so a `limited_member` never reaches it — the page
          renders `LimitedMemberView` for them instead, and the route would 403 anyway. Two
          independent reasons, which is the posture decision #7 asks for. */}
      <MyMoneyCard householdId={householdId} from={budget.periodStart} to={budget.periodEnd} personalSpent={budget.myPersonalSpent} />

      {/* Hero row: MonthProgress + InsightsStrip placeholder */}
      <div className="grid two">
        <MonthProgress budget={budget} />
        <InsightsStrip householdId={householdId} />
      </div>

      {/* Project budgets strip */}
      <ProjectsStrip projects={activeProjects} />

      {/* Categories donut (real data) + Activity feed (real data) */}
      <div className="grid two">
        <CategoriesPanel spending={spendingByCategory} categoryBudgets={categoryBudgets} />
        <ActivityFeed entries={activity} memberColorMap={memberColorMap} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser] = useState<User>();
  const [household, setHousehold] = useState<Household>();
  const [membership, setMembership] = useState<HouseholdMember>();
  const [budget, setBudget] = useState<
    BudgetCurrent & { mySpentAmount: number; myPersonalSpent: number }
  >();
  const [activeProjects, setActiveProjects] = useState<ProjectBudget[]>([]);
  // Iteration 5 — household activity & per-category spend. undefined = not
  // loaded yet; empty array = endpoint responded with no entries (clean
  // empty state). Never invented data.
  const [activity, setActivity] = useState<ActivityEntry[]>();
  const [spendingByCategory, setSpendingByCategory] = useState<SpendingByCategoryEntry[]>();
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>();
  const [memberColorMap, setMemberColorMap] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string>();
  const router = useRouter();
  const pathname = usePathname();

  async function load() {
    setError(undefined);
    try {
      const me = await api.me();
      // No household yet — an authenticated user who never finished onboarding
      // (or whose login `next` pointed straight here). The dashboard has nothing
      // to render, so send them to onboarding instead of hanging on LoadState
      // forever. (2026-06-14 incident — see lib/authRouting.ts.)
      if (requiresOnboarding(me.household)) {
        router.replace("/onboarding");
        return;
      }
      setUser(me.user);
      setHousehold(me.household);
      setMembership(me.membership);
      if (me.household) {
        const isLimited = me.membership?.role === "limited_member";
        // Family-view-only endpoints get .catch(()=>fallback) so a single 403
        // (e.g. role flip mid-session) or transient network error does not
        // blank the entire dashboard — the affected panel just shows empty.
        const [budgetData, projectsData, activityData, spendingData, categoryBudgetsData, membersData] = await Promise.all([
          api.budgetCurrent(me.household.id),
          isLimited
            ? Promise.resolve({ budgets: [] as ProjectBudget[] })
            : api.listProjectBudgets(me.household.id).catch(() => ({
                budgets: [] as ProjectBudget[],
              })),
          isLimited
            ? Promise.resolve({ entries: [] as ActivityEntry[] })
            : api.householdActivity(me.household.id, 50).catch(() => ({
                entries: [] as ActivityEntry[],
              })),
          isLimited
            ? Promise.resolve({ entries: [] as SpendingByCategoryEntry[], periodStart: "", periodEnd: "" })
            : api.spendingByCategory(me.household.id).catch(() => ({
                entries: [] as SpendingByCategoryEntry[],
                periodStart: "",
                periodEnd: "",
              })),
          // Iteration 10 — per-category caps. Family-only; limited_member never
          // fetches it (privacy). A 403/transient error degrades to "no caps".
          isLimited
            ? Promise.resolve({ budgets: [] as CategoryBudget[] })
            : api.categoryBudgets(me.household.id).catch(() => ({
                budgets: [] as CategoryBudget[],
              })),
          isLimited
            ? Promise.resolve({ members: [] as Array<HouseholdMember & { displayName?: string; phoneE164?: string }> })
            : api.listMembers(me.household.id).catch(() => ({
                members: [] as Array<HouseholdMember & { displayName?: string; phoneE164?: string }>,
              })),
        ]);
        setBudget(budgetData);
        const today = new Date().toISOString().slice(0, 10);
        setActiveProjects(
          projectsData.budgets.filter(
            (p) => p.isActive && (!p.endDate || p.endDate >= today)
          )
        );
        setActivity(activityData.entries);
        setSpendingByCategory(spendingData.entries);
        setCategoryBudgets(categoryBudgetsData.budgets);
        const colorMap = new Map<string, string>();
        for (const m of membersData.members) {
          if (m.color) colorMap.set(m.userId, m.color);
        }
        setMemberColorMap(colorMap);
      }
    } catch (err) {
      // Unauthenticated (401): the session cookie lives on api.pingtally.com and is not
      // visible to the frontend, so we detect auth here and redirect to login with a
      // clean loading state instead of showing the raw "Authentication required" message.
      // (Replaces the invalid PGS-002 middleware cookie gate — see lib/authGuard.ts.)
      if (redirectIfUnauthorized(err, router, pathname)) return;
      setError(
        err instanceof Error
          ? err.message
          : "לא הצלחנו לטעון את הדשבורד. נסה לרענן."
      );
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // 2.4.6 / 1.3.1: the error and loading branches replace the whole page, so each
  // needs its own <h1>. .sr-only keeps them at zero pixels - the visible h1 in the
  // ready state is the greeting below.
  if (error) {
    return (
      <AppShell>
        <h1 className="sr-only">דשבורד</h1>
        <LoadState error={error} />
        <Link className="button" href="/login">
          כניסה
        </Link>
      </AppShell>
    );
  }
  if (!user || !household || !budget) {
    return (
      <AppShell>
        <h1 className="sr-only">דשבורד</h1>
        <LoadState />
      </AppShell>
    );
  }

  const role = membership?.role;
  const isLimited = role === "limited_member";
  const greetingName =
    firstName(user.displayName) || user.displayName || user.phoneE164;

  return (
    <AppShell>
      {/* Greeting only — role + household identity live in the sidebar footer (redesign §H/§L). */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
        <Avatar memberId={user.id} displayName={user.displayName} colorKey={membership?.color} size="lg" />
        <div>
          <h1 className="h2" style={{ margin: 0 }}>
            שלום {greetingName} 👋
          </h1>
          <div className="muted" style={{ marginTop: "var(--sp-1)" }}>
            הנה מה שקורה בבית החודש
          </div>
        </div>
      </div>

      {/* 2026-06-12 cold-start fix: while the household has no activity, the bot has
          almost certainly never been messaged — and it CANNOT speak first (Meta 131047
          outside the 24h window). Actionable bridge, dismissible, hidden once activity
          exists or when the bot number env is not configured. Family view only —
          limited members arrive via a WhatsApp invite, so their chat already exists. */}
      {!isLimited && activity !== undefined && activity.length === 0 && <WhatsAppCtaBanner />}

      {/* Baseline edit has a single primary entry point — the "עדכון בסיס התקציב"
          card in /settings (2026-06-17 de-duplication; the dashboard button + the
          /settings/household section were removed to avoid 3 entries / 2 labels). */}

      {isLimited ? (
        <LimitedMemberView budget={budget} membership={membership} />
      ) : (
        <FamilyView
          budget={budget}
          activeProjects={activeProjects}
          role={role}
          householdId={household.id}
          activity={activity}
          spendingByCategory={spendingByCategory}
          categoryBudgets={categoryBudgets}
          memberColorMap={memberColorMap}
        />
      )}
    </AppShell>
  );
}
