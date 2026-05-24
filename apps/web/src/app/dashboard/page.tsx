"use client";

import Link from "next/link";
import { FolderOpen, ListChecks, ReceiptText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { BudgetCurrent, Household, HouseholdMember, ProjectBudget, Receipt, User } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner:          "בעלים",
  admin:          "מנהל",
  adult_member:   "חבר מבוגר",
  limited_member: "חבר מוגבל"
};

const BURN_RATE_LABELS: Record<string, string> = {
  on_track:      "על המסלול ✅",
  slightly_high: "מעט מעל הקצב 🟡",
  high_risk:     "סיכון גבוה 🟠",
  exceeded:      "חרגנו 🔴"
};

function progressColor(pct: number): string {
  if (pct >= 100) return "rose";
  if (pct >= 75) return "amber";
  return "";
}

function firstName(name?: string): string {
  if (!name) return "";
  return name.split(/\s+/)[0] ?? name;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User>();
  const [household, setHousehold] = useState<Household>();
  const [membership, setMembership] = useState<HouseholdMember>();
  const [budget, setBudget] = useState<BudgetCurrent & { mySpentAmount: number; myPersonalSpent: number }>();
  const [activeProjects, setActiveProjects] = useState<ProjectBudget[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      const me = await api.me();
      setUser(me.user);
      setHousehold(me.household);
      setMembership(me.membership);
      if (me.household) {
        const isLimited = me.membership?.role === "limited_member";
        const [budgetData, projectsData, receiptsData] = await Promise.all([
          api.budgetCurrent(me.household.id),
          isLimited ? Promise.resolve({ budgets: [] as ProjectBudget[] }) : api.listProjectBudgets(me.household.id).catch(() => ({ budgets: [] as ProjectBudget[] })),
          isLimited ? Promise.resolve({ receipts: [] as Receipt[] }) : api.receipts().catch(() => ({ receipts: [] as Receipt[] }))
        ]);
        setBudget(budgetData);
        const today = new Date().toISOString().slice(0, 10);
        setActiveProjects(projectsData.budgets.filter((p) => p.isActive && (!p.endDate || p.endDate >= today)));
        setRecentReceipts(receiptsData.receipts.slice(0, 4));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את הדשבורד. נסה לרענן.");
    }
  }

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <AppShell>
        <LoadState error={error} />
        <Link className="button" href="/login">כניסה</Link>
      </AppShell>
    );
  }
  if (!user || !household || !budget) return <AppShell><LoadState /></AppShell>;

  const role = membership?.role;
  const isLimited = role === "limited_member";
  const userName = user.displayName ?? user.phoneE164;
  const greetingName = firstName(user.displayName) || userName;
  const roleLabel = ROLE_LABELS[role ?? ""] ?? "";

  return (
    <AppShell>
      <div className="row between" style={{ marginBottom: 22 }}>
        <div>
          <p className="greeting">שלום {greetingName} 👋</p>
          <div className="muted" style={{ marginTop: 4 }}>
            {household.name}
            {roleLabel && <span className="role-pill" style={{ marginInlineStart: 10 }}>{roleLabel}</span>}
          </div>
        </div>
        <button className="button secondary" onClick={load}>
          <RefreshCw size={18} aria-hidden />
          רענון
        </button>
      </div>

      {isLimited ? <LimitedMemberView budget={budget} membership={membership} /> : null}
      {!isLimited ? <FamilyView budget={budget} activeProjects={activeProjects} recentReceipts={recentReceipts} /> : null}
    </AppShell>
  );
}

// ── Limited-member view (only personal budget; no household budget shown) ───
function LimitedMemberView({
  budget,
  membership
}: {
  budget: BudgetCurrent & { mySpentAmount: number; myPersonalSpent: number };
  membership?: HouseholdMember;
}) {
  const limit = membership?.personalBudgetMonthly;
  const hasLimit = typeof limit === "number" && limit > 0;
  const personalSpent = budget.myPersonalSpent;
  const pct = hasLimit ? Math.min(100, Math.round((personalSpent / limit) * 100)) : 0;
  const colorClass = progressColor(pct);

  return (
    <>
      <section className="hero-panel">
        <h2>התקציב האישי שלי החודש</h2>
        {hasLimit ? (
          <>
            <div className="hero-metric">
              {personalSpent.toLocaleString()}
              <span className="denominator"> / {limit.toLocaleString()} ₪</span>
            </div>
            <div className="progress">
              <div className={`progress-fill ${colorClass}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>נוצלו {pct}% מהתקציב האישי החודשי</div>
            <div className="help-box">
              <div className="help-line">📌 הוצאות אישיות — שלח <strong>#אישי</strong> בסוף ההודעה.</div>
              <div className="help-line">🏠 קניות לבית — נרשמות לתקציב הבית ללא הגבלה.</div>
            </div>
          </>
        ) : (
          <>
            <div className="hero-metric">{personalSpent.toLocaleString()} <span className="denominator">₪</span></div>
            <div className="muted">סך ההוצאות האישיות שלי החודש</div>
            <div className="help-box">
              <div className="help-line">📌 הוצאות אישיות — שלח <strong>#אישי</strong> בסוף ההודעה.</div>
            </div>
          </>
        )}
        <div className="muted" style={{ marginTop: 14 }}>נשארו {budget.daysRemaining} ימים במחזור הנוכחי.</div>
      </section>

      <div className="quick-actions">
        <Link className="button secondary" href="/shopping-list" style={{ textDecoration: "none" }}>
          <ListChecks size={18} aria-hidden />
          רשימת קניות
        </Link>
        <Link className="button secondary" href="/my-requests" style={{ textDecoration: "none" }}>
          הבקשות שלי
        </Link>
      </div>
    </>
  );
}

// ── Owner / admin / adult_member view ─────────────────────────────────────
function FamilyView({
  budget,
  activeProjects,
  recentReceipts
}: {
  budget: BudgetCurrent & { mySpentAmount: number };
  activeProjects: ProjectBudget[];
  recentReceipts: Receipt[];
}) {
  const pct = budget.budgetAmount > 0
    ? Math.min(100, Math.round((budget.spentAmount / budget.budgetAmount) * 100))
    : 0;
  const colorClass = progressColor(pct);
  const burnLabel = BURN_RATE_LABELS[budget.burnRateStatus] ?? budget.burnRateStatus;

  return (
    <>
      <section className="grid three">
        <div className="panel">
          <h2>נשאר החודש</h2>
          <div className="metric">{budget.remainingAmount.toLocaleString()} <span style={{ fontSize: 18, color: "var(--muted)" }}>₪</span></div>
          <div className="muted">{budget.daysRemaining} ימים עד סוף המחזור</div>
        </div>
        <Link href="/dashboard/spending" className="panel" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <h2>נוצל ↗</h2>
          <div className="metric">{budget.spentAmount.toLocaleString()} <span style={{ fontSize: 18, color: "var(--muted)" }}>₪</span></div>
          <div className="muted">מתוך {budget.budgetAmount.toLocaleString()} ₪</div>
          <div className="progress">
            <div className={`progress-fill ${colorClass}`} style={{ width: `${pct}%` }} />
          </div>
        </Link>
        <div className="panel">
          <h2>קצב</h2>
          <div className="metric" style={{ fontSize: 22 }}>{burnLabel}</div>
          <div className="muted">מחזור {budget.periodStart} עד {budget.periodEnd}</div>
        </div>
      </section>

      {activeProjects.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="row between" style={{ alignItems: "baseline" }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderOpen size={20} aria-hidden /> תקציבי פרויקט פעילים
            </h2>
            <Link href="/budget" className="muted" style={{ fontSize: 13, textDecoration: "none" }}>נהל</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {activeProjects.slice(0, 4).map((p) => (
              <Link key={p.id} href={`/budget/project/${p.id}`} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  {p.endDate && <span className="muted" style={{ marginInlineStart: 8, fontSize: 13 }}>עד {p.endDate}</span>}
                </div>
                <span className="muted">{p.totalAmount.toLocaleString()} ₪</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentReceipts.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ReceiptText size={20} aria-hidden /> קבלות אחרונות
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {recentReceipts.map((r) => (
              <Link href={`/receipts/${r.id}/review`} key={r.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
                <span>{r.parsedJson?.merchantName ?? "קבלה"}</span>
                <span className="muted">{r.parsedJson?.totalAmount ? `${r.parsedJson.totalAmount.toLocaleString()} ₪` : r.status}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="quick-actions" style={{ marginTop: 16 }}>
        <Link className="button secondary" href="/shopping-list" style={{ textDecoration: "none" }}>
          <ListChecks size={18} aria-hidden />
          רשימת קניות
        </Link>
        <Link className="button secondary" href="/export" style={{ textDecoration: "none" }}>
          ייצוא CSV
        </Link>
      </div>
    </>
  );
}
