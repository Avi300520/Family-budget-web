"use client";

import Link from "next/link";
import { CheckCircle2, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  FrequencyId,
  Household,
  ReportCatId
} from "@shopping-assistant/shared-types";
import { REPORT_CATEGORIES, monthlyOf, totalMonthlyFixed } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";
import { nis } from "../../../lib/format";
import { useViewer } from "../../../lib/useViewer";
import { canEditBaseline, canEditHouseholdSettings } from "../../../lib/settingsView";

// Hebrew labels for the recurring frequencies (inline map, per the baseline card spec).
const FREQ_LABEL: Record<FrequencyId, string> = {
  weekly: "שבועי",
  monthly: "חודשי",
  bimonthly: "דו-חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי"
};

// Map a fixed-expense report category to its display emoji; generic receipt icon as fallback.
function reportCatIcon(id: ReportCatId): string {
  return REPORT_CATEGORIES.find((c) => c.id === id)?.icon ?? "🧾";
}

export default function HouseholdSettingsPage() {
  const viewer = useViewer();
  const canEdit = canEditHouseholdSettings(viewer.caps);
  const canEditFullBaseline = canEditBaseline(viewer.caps);
  const [household, setHousehold] = useState<Household>();
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
      setHousehold(household);
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

  // Manager-only financial model. `canEdit` (isHouseholdManager) is the same gate that
  // allows editing — never render income/fixed-expense data for a non-manager viewer.
  const baseline = household?.financialBaseline;
  const incomeIsReal = baseline?.budget?.income != null;
  const income = baseline?.budget?.income ?? household?.monthlyBudgetAmount ?? 0;
  const fixedMonthly = baseline ? totalMonthlyFixed(baseline.fixedExpenses) : 0;
  const available = Math.max(0, income - fixedMonthly);
  const activeFixed = baseline ? baseline.fixedExpenses.filter((f) => f.isActive) : [];

  return (
    <AppShell>
      <h1 className="page-title">פרטי משק הבית</h1>
      <p className="muted" style={{ marginBottom: 20 }}>המודל המלא של הבית - הכנסות, הוצאות קבועות ומבנה החודש.</p>

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
            <span className="muted" style={{ fontSize: 13 }}>היום בחודש שבו מתחדש התקציב (1-28).</span>
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

      {/* Full financial model — manager-only (income/financial data). Gated by the same
          capability that allows editing; never rendered for non-managers. */}
      {canEdit && (
        <section className="panel" style={{ maxWidth: 480, marginTop: 16 }}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>המודל המלא של הבית</h2>
          {baseline ? (
            <>
              <div className="grid three">
                <div style={{ background: "var(--cream-2)", borderRadius: "var(--r-3)", padding: "var(--sp-3)" }}>
                  <div className="label">{incomeIsReal ? "הכנסה" : "תקציב"}</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{nis(income)}</div>
                </div>
                <div style={{ background: "var(--cream-2)", borderRadius: "var(--r-3)", padding: "var(--sp-3)" }}>
                  <div className="label">הוצאות קבועות</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{nis(fixedMonthly)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{activeFixed.length} חשבונות</div>
                </div>
                <div style={{ background: "var(--cream-2)", borderRadius: "var(--r-3)", padding: "var(--sp-3)" }}>
                  <div className="label">פנוי לניהול</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{nis(available)}</div>
                </div>
              </div>

              {activeFixed.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  {activeFixed.map((f) => (
                    <div
                      key={f.id}
                      className="row between"
                      style={{ gap: 12, padding: "var(--sp-2) 0", borderBottom: "1px solid var(--cream-3)" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span className="cat-tile" style={{ background: "var(--cream-1)" }} aria-hidden>
                          {reportCatIcon(f.reportCat)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{f.label}</div>
                          {f.frequency !== "monthly" && (
                            <div className="muted" style={{ fontSize: 12 }}>
                              {FREQ_LABEL[f.frequency]} · {nis(monthlyOf(f.amount, f.frequency))}/חודש
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="mono" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{nis(f.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted">עוד לא הוגדר מודל מלא - השלימו דרך האשף למטה.</p>
          )}
        </section>
      )}

      {/* Re-run the full onboarding wizard against the existing household (edit mode).
          Manager-only — mirrors the backend POST /onboarding/complete authz. */}
      {canEditFullBaseline && (
        <Link
          className="panel settings-card"
          href="/onboarding?mode=edit"
          style={{ maxWidth: 480, marginTop: 16, background: "var(--teal-bg)", borderColor: "var(--teal-soft)" }}
        >
          <span className="settings-card__icon" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
            <SlidersHorizontal size={22} aria-hidden />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 className="settings-card__title">עדכון מלא דרך אשף ההגדרה</h2>
            <p className="settings-card__desc">
              השתנה משהו - רכב חדש, צהרון נגמר, שינוי במשכורת? עברו על כל ההכנסות, הקבועות והתקציבים בבת אחת.
            </p>
          </div>
          <ChevronLeft className="settings-card__chev" size={20} aria-hidden />
        </Link>
      )}
    </AppShell>
  );
}
