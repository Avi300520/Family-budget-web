"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

export default function HouseholdSettingsPage() {
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
    if (!householdId) return;
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
            />
          </label>
          <button className="button" type="submit" disabled={saving || !monthlyBudgetAmount}>
            <CheckCircle2 size={18} aria-hidden />
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
          {success && <div className="status success">הגדרות נשמרו בהצלחה.</div>}
          {error && <div className="status error">{error}</div>}
        </form>
      </section>
    </AppShell>
  );
}
