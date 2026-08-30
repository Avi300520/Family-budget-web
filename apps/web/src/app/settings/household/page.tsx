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
import { LoadState } from "../../../components/LoadState";
import { DayChips, Field, MoneyInput, TextInput } from "../../onboarding/controls";
import { announce } from "../../../lib/a11y/announce";
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

// Stable ids for the one validated field on this page: the <label htmlFor> Field renders,
// the aria-describedby target, and the post-validation focus move all point at them.
const AMOUNT_ID = "hh-amount";
const AMOUNT_ERROR_ID = "hh-amount-error";
const CITY_ID = "hh-city";

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
  // 0 == the amount field is valid. It is a COUNTER, not a boolean, so a repeated failed
  // attempt with the SAME message still changes state and re-runs the focus effect below.
  const [amountErrorAt, setAmountErrorAt] = useState(0);
  const amountInvalid = amountErrorAt > 0;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

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

  // 3.3.1 - the focus move to the invalid field must happen AFTER React commits
  // aria-invalid / aria-describedby. A focus() called synchronously inside handleSave
  // lands before those attributes exist, so the reader announces the field as valid.
  useEffect(() => {
    if (amountErrorAt === 0) return;
    document.getElementById(AMOUNT_ID)?.focus();
  }, [amountErrorAt]);

  const dirty =
    monthlyBudgetAmount !== savedSnapshot.amount ||
    budgetCycleDay !== savedSnapshot.day ||
    defaultCity !== savedSnapshot.city;

  async function handleSave() {
    // `saving` is guarded here rather than on the button: disabling the button the user just
    // pressed drops focus to <body> (2.4.3). Re-entry is impossible either way.
    if (!householdId || !canEdit || saving) return;
    // The button now stays mounted (and focused) in the "נשמר" state, so a press with
    // nothing to save must stay a no-op rather than re-issuing the same PUT.
    if (!dirty) return;
    if (monthlyBudgetAmount === "" || !(Number(monthlyBudgetAmount) > 0)) {
      // 3.3.1 - an empty/zero amount used to leave the button silently inert. It now marks the
      // field invalid, pulls focus to it (effect above) and renders in the role="alert" div.
      // The alert is KEYED on this counter (below), which is what makes a repeat attempt speak:
      // writing an identical string into an already-mounted alert is not a DOM mutation, so it
      // would otherwise be silent from the second press on. An earlier revision also called
      // announce() here - that fixed the repeat but made the FIRST failure speak twice.
      setError("הזינו סכום תקציב חוקי.");
      setAmountErrorAt((n) => n + 1);
      return;
    }
    setSaving(true);
    setError(undefined);
    setAmountErrorAt(0);
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
      // 4.1.3 - the visible "נשמר" lives inside the save bar, which unmounts ~1.8s later,
      // so a live region hosted there would mount and vanish with its own content. The
      // shared announcer is the only thing that survives long enough to be read.
      announce("נשמר");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        // 2.4.3 - do not pull the save bar out from under a keyboard user who is still
        // standing on the save button; unmounting the focused element drops focus to <body>.
        if (document.activeElement === saveBtnRef.current) return;
        setJustSaved(false);
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לשמור. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  // ── states ─────────────────────────────────────────────────────────────────────
  // Every rendered state needs its own <h1> (2.4.6/1.3.1); LoadState carries role="status".
  if (viewer.status === "loading") {
    return <AppShell><h1 className="page-title">פרטי משק הבית</h1><LoadState /></AppShell>;
  }

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

  if (loading) {
    return <AppShell><h1 className="page-title">פרטי משק הבית</h1><LoadState /></AppShell>;
  }

  const baseline = household?.financialBaseline;
  // ── SEPACCT `AMENDMENT_16` §A60 — **A LABEL THAT NO LONGER DESCRIBES ITS NUMBER IS THE SAME
  //    DEFECT AS A REFUSAL THAT LOOKS LIKE SUCCESS.** `R-2` found this after the arming.
  //
  // Under separate accounts the server DELETES `budget.income` from every read and marks the
  // document `incomeRedacted`. It deliberately leaves `budget.mode` alone — the mode is how the
  // household set its budget up, not a claim about what is readable — so `mode === "income"` stays
  // true while the figure is gone, and the `??` below then fell through to `monthlyBudgetAmount`.
  // The page went on rendering "הכנסה חודשית נטו" over the MANAGED BUDGET: measured ₪20,000 →
  // ₪8,000 with no notice, and `פנוי לניהול` wrong by the same substitution.
  //
  // 🔑 Reading the mark makes the page tell the truth with no new copy: a redacted household is
  // rendered exactly as a budget-mode household, because that is what its readable figures ARE.
  const incomeRedacted = baseline?.budget?.incomeRedacted === true;
  const incomeMode = baseline?.budget?.mode === "income" && !incomeRedacted;
  const income = baseline?.budget?.income ?? household?.monthlyBudgetAmount ?? 0;
  const fixedMonthly = baseline ? totalMonthlyFixed(baseline.fixedExpenses) : 0;
  const available = Math.max(0, income - fixedMonthly);
  const activeFixed = baseline ? baseline.fixedExpenses.filter((f) => f.isActive) : [];

  return (
    <AppShell>
      <h1 className="page-title">פרטי משק הבית</h1>
      <p className="muted" style={{ marginBottom: 20 }}>המודל המלא של הבית - הכנסות, הוצאות קבועות ומבנה החודש.</p>

      {/* ── Quick settings (income/budget · cycle day · region) ── */}
      <div className="label" style={{ marginBottom: 10 }}>הגדרות מהירות</div>
      <section className="panel" style={{ maxWidth: 480, marginBottom: 16 }}>
        <Field
          label={incomeMode ? "הכנסה חודשית נטו (₪)" : "תקציב חודשי (₪)"}
          htmlFor={AMOUNT_ID}
          hint={incomeMode ? "הסכום שעליו נבנה כל התקציב. אפשר לעדכן בכל שינוי בשכר." : undefined}
        >
          <div style={{ maxWidth: 240 }}>
            {/* The name comes from the real <label htmlFor> that Field renders, so it is the
                visible text itself and cannot drift - and it is not also duplicated as an
                aria-label, which made AT read the name twice. */}
            <MoneyInput
              id={AMOUNT_ID}
              value={monthlyBudgetAmount}
              onChange={(v) => {
                setMonthlyBudgetAmount(v);
                // 3.3.1 - the validation message must not outlive the problem it describes.
                if (amountInvalid) {
                  setAmountErrorAt(0);
                  setError(undefined);
                }
              }}
              invalid={amountInvalid}
              describedById={amountInvalid ? AMOUNT_ERROR_ID : undefined}
            />
          </div>
        </Field>

        <Field label="יום תחילת החודש התקציבי" hint="היום בחודש שבו מתחדש התקציב (1-28)." style={{ marginTop: 22 }}>
          <DayChips value={budgetCycleDay} onChange={(v) => setBudgetCycleDay(v)} />
        </Field>

        <Field label="אזור קניות" htmlFor={CITY_ID} hint="עוזר להשוואות ולזיהוי חנויות בצ׳אט." style={{ marginTop: 22 }}>
          <div style={{ maxWidth: 320 }}>
            {/* Named by Field's <label htmlFor> - no duplicate ariaLabel (see above). */}
            <TextInput id={CITY_ID} value={defaultCity} onChange={(v) => setDefaultCity(v)} placeholder="בני ברק" />
          </div>
        </Field>

        {/* role="alert" - both the validation message and a save failure appear after the
            page has rendered, and were previously silent to a screen reader (4.1.3/3.3.1).
            The id is the aria-describedby target of the amount field; it is only referenced
            while `amountInvalid`, so a save failure never becomes a dangling description. */}
        {/* key={amountErrorAt}: remounts the node on every failed attempt, so role="alert" is
            genuinely INSERTED each time and speaks again even when the message is identical. */}
        {error && <div key={amountErrorAt} id={AMOUNT_ERROR_ID} className="status error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      </section>

      {/* ── Full financial model (read-only summary) ── */}
      <div className="label" style={{ marginBottom: 10 }}>המודל המלא של הבית</div>
      <section className="panel" style={{ maxWidth: 480, marginBottom: 16 }}>
        {baseline ? (
          <>
            {/* §A60: say that a figure is being withheld rather than quietly showing another one. */}
            {incomeRedacted && (
              <p className="status" style={{ display: "block", marginBottom: 14 }}>
                כשהחשבונות בבית מנוהלים בנפרד, אין הכנסה משותפת להציג כאן. ההכנסה של כל אחד פרטית ונשמרת אצלו.
              </p>
            )}
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
          {!(justSaved && !dirty) && <span className="muted">יש שינויים שלא נשמרו</span>}
          {/* 2.4.3 - the SAME button element is kept mounted across all three states and its
              LABEL carries the state instead. Swapping it for a non-focusable "✓ נשמר" span
              on success (the common path) dropped focus to <body>; removing `disabled` alone
              never fixed that. Re-entry, the no-op press and the empty-amount case are all
              guarded inside handleSave (3.3.1), not by disabling the focused control. */}
          <button
            ref={saveBtnRef}
            type="button"
            className="btn primary"
            onClick={handleSave}
            aria-busy={saving || undefined}
          >
            {saving ? "שומר..." : justSaved && !dirty ? "✓ נשמר" : "שמירת שינויים"}
          </button>
        </div>
      )}
    </AppShell>
  );
}
