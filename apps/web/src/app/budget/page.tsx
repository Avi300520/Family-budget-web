"use client";

import Link from "next/link";
import { Archive, FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { BudgetCurrent, Household, ProjectBudget } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";

function progressColor(pct: number): string {
  if (pct >= 100) return "rose";
  if (pct >= 75) return "amber";
  return "";
}

export default function BudgetPage() {
  const [household, setHousehold] = useState<Household>();
  const [budget, setBudget] = useState<BudgetCurrent>();
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      const [budgetData, projectsData] = await Promise.all([
        api.budgetCurrent(current.household.id),
        api.listProjectBudgets(current.household.id)
      ]);
      setBudget(budgetData);
      setProjects(projectsData.budgets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את התקציב.");
    }
  }

  useEffect(() => { load(); }, []);

  async function createBudget(event: React.FormEvent) {
    event.preventDefault();
    if (!household || !name.trim() || !total) return;
    setCreating(true);
    setError(undefined);
    try {
      const body: { name: string; totalAmount: number; endDate?: string } = {
        name: name.trim(),
        totalAmount: Number(total)
      };
      if (endDate) body.endDate = endDate;
      await api.createProjectBudget(household.id, body);
      setName("");
      setTotal("");
      setEndDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו ליצור תקציב פרויקט.");
    } finally {
      setCreating(false);
    }
  }

  async function archiveBudget(budgetId: string) {
    if (!household) return;
    if (!confirm("להסיר את תקציב הפרויקט? ההוצאות שכבר נרשמו יישארו.")) return;
    setError(undefined);
    try {
      await api.deleteProjectBudget(household.id, budgetId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו להסיר את התקציב.");
    }
  }

  if (error) return <AppShell><LoadState error={error} /></AppShell>;
  if (!household || !budget) return <AppShell><LoadState /></AppShell>;

  const activeProjects = projects.filter((p) => p.isActive);
  const householdPct = budget.budgetAmount > 0 ? Math.min(100, Math.round((budget.spentAmount / budget.budgetAmount) * 100)) : 0;

  return (
    <AppShell>
      <h1 className="page-title">תקציב</h1>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>התקציב החודשי של הבית</h2>
        <div className="grid three" style={{ marginTop: 12 }}>
          <div>
            <div className="muted">סך הכל</div>
            <div className="metric">{budget.budgetAmount.toLocaleString()} ₪</div>
          </div>
          <div>
            <div className="muted">הוצא</div>
            <div className="metric">{budget.spentAmount.toLocaleString()} ₪</div>
          </div>
          <div>
            <div className="muted">נותר</div>
            <div className="metric">{budget.remainingAmount.toLocaleString()} ₪</div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 12 }}>
          <div className={`progress-fill ${progressColor(householdPct)}`} style={{ width: `${householdPct}%` }} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>נוצלו {householdPct}% מהתקציב החודשי</div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>תקציבי פרויקט פעילים</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>תקציבים מוגדרי-זמן (חופשה, שיפוץ וכו'). להוצאה: שלח ב-WhatsApp עם <code>#שם-הפרויקט</code>.</p>
        {activeProjects.length === 0 ? (
          <p className="muted">אין תקציבי פרויקט פעילים.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeProjects.map((p) => (
              <div key={p.id} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <Link href={`/budget/project/${p.id}`} style={{ color: "inherit", textDecoration: "none", flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                      תקציב: {p.totalAmount.toLocaleString()} ₪
                      {p.endDate && ` · עד ${p.endDate}`}
                      <span style={{ marginInlineStart: 8 }}>· הצג הוצאות →</span>
                    </div>
                  </Link>
                  <button className="button secondary" onClick={() => archiveBudget(p.id)} style={{ padding: "4px 8px" }} title="הסר תקציב">
                    <Archive size={14} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>הוסף תקציב פרויקט</h2>
        <form className="form" onSubmit={createBudget} style={{ marginTop: 12 }}>
          <label>
            שם הפרויקט
            <input className="input" value={name} placeholder='למשל: "שיפוץ" / "חופשה ביוון"' onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            סכום כולל (₪)
            <input className="input" type="number" min={1} max={10000000} value={total} placeholder="למשל: 15000" onChange={(e) => setTotal(e.target.value)} />
          </label>
          <label>
            תאריך סיום (אופציונלי)
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button className="button" type="submit" disabled={creating || !name.trim() || !total}>
            <FolderPlus size={18} aria-hidden />
            צור תקציב
          </button>
        </form>
      </section>
    </AppShell>
  );
}
