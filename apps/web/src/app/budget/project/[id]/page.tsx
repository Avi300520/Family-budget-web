"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Household, ProjectBudget, Purchase } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../../components/AppShell";
import { LoadState } from "../../../../components/LoadState";
import { api } from "../../../../lib/api";
import { heDate } from "../../../../lib/format";

import { CATEGORY_LABELS } from "../../../../lib/categories";

function progressColor(pct: number): string {
  if (pct >= 100) return "rose";
  if (pct >= 75) return "amber";
  return "";
}

export default function ProjectBudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const [household, setHousehold] = useState<Household>();
  const [budget, setBudget] = useState<ProjectBudget>();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [spent, setSpent] = useState(0);
  const [error, setError] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      const result = await api.getProjectBudgetDetail(current.household.id, params.id);
      setBudget(result.budget);
      setPurchases(result.purchases);
      setSpent(result.spent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את התקציב.");
    }
  }

  useEffect(() => { load(); }, [params.id]);

  // BATCH-GI 1.3.1/2.4.6 - the error and loading branches replace the whole page, so without
  // their own <h1> those states render with no heading at all.
  if (error) return <AppShell><h1 className="page-title">תקציב פרויקט</h1><LoadState error={error} /></AppShell>;
  if (!household || !budget) return <AppShell><h1 className="page-title">תקציב פרויקט</h1><LoadState /></AppShell>;

  const endDateLabel = heDate(budget.endDate);
  const remaining = Math.max(0, budget.totalAmount - spent);
  const pct = budget.totalAmount > 0 ? Math.min(100, Math.round((spent / budget.totalAmount) * 100)) : 0;

  return (
    <AppShell>
      <Link href="/budget" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12, textDecoration: "none" }}>
        <ArrowRight size={14} aria-hidden />
        חזרה לתקציבים
      </Link>
      <h1 className="page-title">{budget.name}</h1>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="grid three">
          <div>
            <div className="muted">תקציב כולל</div>
            <div className="metric">{budget.totalAmount.toLocaleString()} ₪</div>
          </div>
          <div>
            <div className="muted">נוצל</div>
            <div className="metric">{spent.toLocaleString()} ₪</div>
          </div>
          <div>
            <div className="muted">נשאר</div>
            <div className="metric">{remaining.toLocaleString()} ₪</div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 12 }}>
          <div className={`progress-fill ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          נוצלו {pct}%{endDateLabel ? ` · תאריך סיום ${endDateLabel}` : ""}
        </div>
      </section>

      <section className="panel">
        <h2>הוצאות שנרשמו לפרויקט</h2>
        {purchases.length === 0 ? (
          <p className="muted" style={{ marginTop: 8 }}>אין עדיין הוצאות שנרשמו לפרויקט הזה.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {purchases.map((p) => (
              <div key={p.id} className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.merchantNameRaw ?? "הוצאה"}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {heDate(p.purchaseDate) ?? p.purchaseDate} · {CATEGORY_LABELS[p.category] ?? p.category}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{p.totalAmount.toLocaleString()} ₪</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
