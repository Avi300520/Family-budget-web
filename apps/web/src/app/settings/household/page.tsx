"use client";

import { CheckCircle2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";
import { useViewer } from "../../../lib/useViewer";
import { canEditBaseline, canEditHouseholdSettings } from "../../../lib/settingsView";

export default function HouseholdSettingsPage() {
  const viewer = useViewer();
  const canEdit = canEditHouseholdSettings(viewer.caps);
  const canBaseline = canEditBaseline(viewer.caps);
  const [householdId, setHouseholdId] = useState<string>();
  const [monthlyBudgetAmount, setMonthlyBudgetAmount] = useState<number | "">("");
  const [budgetCycleDay, setBudgetCycleDay] = useState<number>(1);
  const [defaultCity, setDefaultCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.currentHousehold().then(({ household }) => {
      setHouseholdId(household.id);
      setMonthlyBudgetAmount(household.monthlyBudgetAmount);
      setBudgetCycleDay(household.budgetCycleDay);
      setDefaultCity(household.defaultCity ?? "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!householdId || !canEdit) return;
    setSaving(true);
    setSuccess(false);
    setError(undefined);
    try {
      await api.updateHouseholdSettings(householdId, {
        monthlyBudgetAmount: Number(monthlyBudgetAmount),
        budgetCycleDay,
        defaultCity: defaultCity.trim()
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לשמור. נסה שוב.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><p className="muted">טוען...</p></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">הגדרות בית</h1>
      <p className="muted" style={{ marginBottom: 20 }}>תקציב חודשי, יום תחילת חודש ואזור קניות.</p>
      <section className="panel" style={{ maxWidth: 480 }}>
        {viewer.status === "ready" && !canEdit && (
          <div className="status" style={{ display: "block", marginBottom: 12 }}>
            רק בעלים או מנהל יכולים לשנות את הגדרות הבית. אתם רואים את הפרטים לצפייה בלבד.
          </div>
        )}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            תקציב חודשי (₪)
            <input
              className="input"
              type="number"
              min={100}
              max={100000}
              value={monthlyBudgetAmount}
              onChange={(e) => setMonthlyBudgetAmount(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canEdit}
              required
            />
          </label>
          <label>
            יום תחילת חודש תקציבי
            <input
              className="input"
              type="number"
              min={1}
              max={28}
              value={budgetCycleDay}
              onChange={(e) => setBudgetCycleDay(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
              disabled={!canEdit}
              required
            />
            <span className="muted" style={{ fontSize: 13 }}>היום בחודש שבו מתחדש התקציב (1–28).</span>
          </label>
          <label>
            אזור קניות
            <input
              className="input"
              value={defaultCity}
              placeholder="העיר / שכונה שלך"
              onChange={(e) => setDefaultCity(e.target.value)}
              disabled={!canEdit}
            />
          </label>
          {canEdit && (
            <button className="button" type="submit" disabled={saving || !monthlyBudgetAmount}>
              <CheckCircle2 size={18} aria-hidden />
              {saving ? "שומר..." : "שמור שינויים"}
            </button>
          )}
          {success && <div className="status success">הגדרות נשמרו בהצלחה.</div>}
          {error && <div className="status error">{error}</div>}
        </form>
      </section>

      {canBaseline && (
        <section className="panel" style={{ maxWidth: 480, marginTop: 16 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SlidersHorizontal size={18} aria-hidden />
            עריכה מתקדמת
          </h2>
          <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
            בנו מחדש את בסיס התקציב — הכנסות, הוצאות קבועות, תקציבי קטגוריות והתראות.
          </p>
          <Link className="button secondary" href="/onboarding?mode=edit" style={{ textDecoration: "none" }}>
            עדכון בסיס התקציב
          </Link>
        </section>
      )}
    </AppShell>
  );
}
