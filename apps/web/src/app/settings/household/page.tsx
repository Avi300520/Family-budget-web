"use client";

import Link from "next/link";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  FrequencyId,
  Household,
  ReportCatId
} from "@shopping-assistant/shared-types";
import { REPORT_CATEGORIES, monthlyOf, totalMonthlyFixed } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { DayChips, Field, MoneyInput, TextInput } from "../../onboarding/controls";
import { api } from "../../../lib/api";
import { nis } from "../../../lib/format";
import { useViewer } from "../../../lib/useViewer";
import { canEditBaseline, canEditHouseholdSettings, canViewHouseholdSettings } from "../../../lib/settingsView";

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

// Summary stat tile (ported from the design ScreenHousehold StatTile). `strong` paints the
// emphasized "פנוי לניהול" tile teal; `minus` prefixes a hyphen to a deduction value.
function StatTile({ label, value, sub, strong, minus }: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
  minus?: boolean;
}) {
  return (
    <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 13, background: strong ? "var(--teal-bg)" : "var(--cream-1)" }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: strong ? "var(--teal-dark)" : "var(--text-0)" }}>
        {minus ? "-" : ""}{value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function HouseholdSettingsPage() {
  const viewer = useViewer();
  // canView == canEdit == isHouseholdManager here; the whole financial view is manager-only.
  const canView = canViewHouseholdSettings(viewer.caps);
  const canEdit = canEditHouseholdSettings(viewer.caps);
  const canEditFullBaseline = canEditBaseline(viewer.caps);

  const [household, setHousehold] = useState<Household>();
  const [householdId, setHouseholdId] = useState<string>();
  const [monthlyBudgetAmount, setMonthlyBudgetAmount] = useState<number | "">("");
  const [budgetCycleDay, setBudgetCycleDay] = useState<number>(1);
  const [defaultCity, setDefaultCity] = useState("");
  // Last-persisted snapshot of the three editable fields - the diff baseline for the save bar.
  const [savedSnapshot, setSavedSnapshot] = useState<{ amount: number | ""; day: number; city: string }>({
    amount: "",
    day: 1,
    city: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string>();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function seed(h: Household) {
    setHousehold(h);
    setHouseholdId(h.id);
    setMonthlyBudgetAmount(h.monthlyBudgetAmount);
    setBudgetCycleDay(h.budgetCycleDay);
    setDefaultCity(h.defaultCity ?? "");
    setSavedSnapshot({ amount: h.monthlyBudgetAmount, day: h.budgetCycleDay, city: h.defaultCity ?? "" });
  }

  useEffect(() => {
    if (viewer.status !== "ready") return;
    // Never fetch household financials for a non-manager (privacy): a limited/plain-adult member
    // who navigates here directly issues no /households/current request.
    if (!viewer.hasHousehold || !canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .currentHousehold()
      .then(({ household: h }) => {
        if (cancelled) return;
        seed(h);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewer.status, viewer.hasHousehold, canView]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  async function handleSave() {
    if (!householdId || !canEdit) return;
    if (monthlyBudgetAmount === "" || !(Number(monthlyBudgetAmount) > 0)) {
      setError("הזינו סכום תקציב חוקי.");
      return;
    }
    setSaving(true);
    setError(undefined);
    setJustSaved(false);
    try {
      await api.updateHouseholdSettings(householdId, {
        monthlyBudgetAmount: Number(monthlyBudgetAmount),
        budgetCycleDay,
        defaultCity: defaultCity.trim()
      });
      // Re-fetch so the full-model figures (income / fixed / available) aren't stale after a save.
      const { household: fresh } = await api.currentHousehold();
      seed(fresh);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לשמור. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  // ── states ─────────────────────────────────────────────────────────────────────
  if (viewer.status === "loading") return <AppShell><p className="muted">טוען...</p></AppShell>;

  if (viewer.status === "error") {
    return (
      <AppShell>
        <h1 className="page-title">פרטי משק הבית</h1>
        <section className="panel" style={{ maxWidth: 480 }}>
          <p className="muted">לא הצלחנו לטעון את פרטי הבית. נסו לרענן.</p>
        </section>
      </AppShell>
    );
  }

  // Privacy gate: a non-manager (especially limited_member) must NOT see the household
  // budget / cycle / city - only a friendly access message.
  if (!canView) {
    return (
      <AppShell>
        <h1 className="page-title">פרטי משק הבית</h1>
        <section className="panel" style={{ maxWidth: 480 }}>
          <p className="muted">
            פרטי משק הבית - הכנסות, תקציב ומבנה החודש - זמינים לבעלים ולמנהלי הבית בלבד.
          </p>
        </section>
      </AppShell>
    );
  }

  if (loading) return <AppShell><p className="muted">טוען...</p></AppShell>;

  const baseline = household?.financialBaseline;
  const incomeMode = baseline?.budget?.mode === "income";
  const income = baseline?.budget?.income ?? household?.monthlyBudgetAmount ?? 0;
  const fixedMonthly = baseline ? totalMonthlyFixed(baseline.fixedExpenses) : 0;
  const available = Math.max(0, income - fixedMonthly);
  const activeFixed = baseline ? baseline.fixedExpenses.filter((f) => f.isActive) : [];

  const dirty =
    monthlyBudgetAmount !== savedSnapshot.amount ||
    budgetCycleDay !== savedSnapshot.day ||
    defaultCity !== savedSnapshot.city;

  return (
    <AppShell>
      <h1 className="page-title">פרטי משק הבית</h1>
      <p className="muted" style={{ marginBottom: 20 }}>המודל המלא של הבית - הכנסות, הוצאות קבועות ומבנה החודש.</p>

      {/* ── Quick settings (income/budget · cycle day · region) ── */}
      <div className="label" style={{ marginBottom: 10 }}>הגדרות מהירות</div>
      <section className="panel" style={{ maxWidth: 480, marginBottom: 16 }}>
        <Field
          label={incomeMode ? "הכנסה חודשית נטו (₪)" : "תקציב חודשי (₪)"}
          hint={incomeMode ? "הסכום שעליו נבנה כל התקציב. אפשר לעדכן בכל שינוי בשכר." : undefined}
        >
          <div style={{ maxWidth: 240 }}>
            <MoneyInput value={monthlyBudgetAmount} onChange={(v) => setMonthlyBudgetAmount(v)} />
          </div>
        </Field>

        <Field label="יום תחילת החודש התקציבי" hint="היום בחודש שבו מתחדש התקציב (1-28)." style={{ marginTop: 22 }}>
          <DayChips value={budgetCycleDay} onChange={(v) => setBudgetCycleDay(v)} />
        </Field>

        <Field label="אזור קניות" hint="עוזר להשוואות ולזיהוי חנויות בצ׳אט." style={{ marginTop: 22 }}>
          <div style={{ maxWidth: 320 }}>
            <TextInput value={defaultCity} onChange={(v) => setDefaultCity(v)} placeholder="בני ברק" />
          </div>
        </Field>

        {error && <div className="status error" style={{ marginTop: 16 }}>{error}</div>}
      </section>

      {/* ── Full financial model (read-only summary) ── */}
      <div className="label" style={{ marginBottom: 10 }}>המודל המלא של הבית</div>
      <section className="panel" style={{ maxWidth: 480, marginBottom: 16 }}>
        {baseline ? (
          <>
            <div className="grid three" style={{ marginBottom: 18 }}>
              <StatTile label={incomeMode ? "הכנסה" : "תקציב"} value={nis(income)} />
              <StatTile label="הוצאות קבועות" value={nis(fixedMonthly)} minus sub={`${activeFixed.length} חשבונות`} />
              <StatTile label="פנוי לניהול" value={nis(available)} strong />
            </div>

            {activeFixed.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeFixed.map((f) => (
                  <div
                    key={f.id}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: "var(--cream-1)" }}
                  >
                    <span className="cat-tile" style={{ background: "var(--cream-2)" }} aria-hidden>
                      {reportCatIcon(f.reportCat)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</div>
                      {f.frequency !== "monthly" && (
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>
                          {FREQ_LABEL[f.frequency]} · {nis(monthlyOf(f.amount, f.frequency))}/חודש
                        </div>
                      )}
                    </div>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{nis(f.amount)}</span>
                    {f.isEstimate && <span className="chip ocean" style={{ height: 20, fontSize: 10.5 }}>הערכה</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="muted">עוד לא הוגדר מודל מלא - השלימו דרך האשף למטה.</p>
        )}
      </section>

      {/* Re-run the full onboarding wizard against the existing household (edit mode).
          Manager-only - mirrors the backend POST /onboarding/complete authz. */}
      {canEditFullBaseline && (
        <Link
          className="panel settings-card"
          href="/onboarding?mode=edit"
          style={{ maxWidth: 480, background: "var(--teal-bg)", borderColor: "var(--teal-soft)" }}
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

      {/* Sticky save bar - dirty-aware; shows a transient "נשמר" for ~1.8s after a save. */}
      {(dirty || justSaved) && (
        <div className="save-bar">
          {justSaved && !dirty ? (
            <span style={{ color: "var(--pos)", fontWeight: 700 }}>✓ נשמר</span>
          ) : (
            <>
              <span className="muted">יש שינויים שלא נשמרו</span>
              <button
                type="button"
                className="btn primary"
                onClick={handleSave}
                disabled={saving || monthlyBudgetAmount === ""}
              >
                {saving ? "שומר..." : "שמירת שינויים"}
              </button>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
