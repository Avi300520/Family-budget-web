"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CategoryBudget } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { announce } from "../../../lib/a11y/announce";
import { api } from "../../../lib/api";
import { redirectIfUnauthorized } from "../../../lib/authGuard";
import { BUDGET_CATEGORIES, CAP_BUCKETS } from "../../../lib/categories";
import { nis } from "../../../lib/format";
import { SEPACCT_UI_ENABLED } from "../../../lib/sepacct";
import { isHouseholdManager } from "../../../lib/settingsView";
import { useViewer } from "../../../lib/useViewer";

// The "canonical 14" display taxonomy (design handoff) lives in lib/categories.
// Only the `capable` rows own a UNIQUE backend bucket and carry a real cap — the
// backend cap endpoint validates EXACTLY the 7-enum, so the 8 tracking rows that
// all roll into `other` are shown read-only (no fake caps, no migration).
const CAP_CATEGORIES = BUDGET_CATEGORIES.filter((c) => c.capable); // 6 editable rows
const TRACKING_CATEGORIES = BUDGET_CATEGORIES.filter((c) => !c.capable); // 8 display rows

const CAP_INVALID_MSG = "התקרה חייבת להיות מספר גדול מ-0.";
const CAP_ERROR_ID = "cap-error";

// Summary stat tile - mirrors the design handoff's StatTile (set-screens-a.jsx):
// centered label + mono value, with a teal-bg "strong" highlight variant.
function StatTile({
  label,
  value,
  sub,
  strong,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--sp-3) var(--sp-2)",
        borderRadius: "var(--r-3)",
        background: strong ? "var(--teal-bg)" : "var(--cream-1)",
      }}
    >
      <div className="label" style={{ marginBottom: "var(--sp-1)" }}>{label}</div>
      <div
        className="mono"
        style={{ fontSize: 20, fontWeight: 700, color: color ?? (strong ? "var(--teal-dark)" : "var(--text-0)") }}
      >
        {value}
      </div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function CategoryBudgetsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const viewer = useViewer();
  const canManage = isHouseholdManager(viewer.caps);

  const [householdId, setHouseholdId] = useState<string>();
  const [income, setIncome] = useState<number | null>(null);
  // SEPACCT §A60: the income is not "unknown", it is WITHHELD while the accounts are separate.
  // The distinction is the whole ruling, so the tile says which one it is.
  const [incomeRedacted, setIncomeRedacted] = useState(false);
  // Server-loaded caps (category → monthlyLimit) — the diff baseline for save.
  const [server, setServer] = useState<Record<string, number>>({});
  // Local row state: a string (incl. "") = capped/input mode; null/absent = uncapped.
  const [local, setLocal] = useState<Record<string, string | null>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string>();
  // The cap bucket that failed validation - drives aria-invalid/aria-describedby AND the
  // post-commit focus move (see the effect below).
  const [invalidCap, setInvalidCap] = useState<string | null>(null);
  // Attempt counter, used only as the alert's `key` so a repeated identical validation
  // message still remounts the alert node and is therefore announced again.
  const [capErrorAt, setCapErrorAt] = useState(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function seed(budgets: CategoryBudget[]) {
    const srv: Record<string, number> = {};
    const loc: Record<string, string | null> = {};
    for (const b of budgets) {
      srv[b.category] = b.monthlyLimit;
      loc[b.category] = String(b.monthlyLimit);
    }
    setServer(srv);
    setLocal(loc);
  }

  useEffect(() => {
    if (viewer.status !== "ready") return;
    // Never fetch as a non-manager: a limited/plain-adult member who navigates here
    // directly issues no /category-budgets request (the AppShell already hides this).
    if (!viewer.hasHousehold || !canManage) {
      setLoadingData(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { household } = await api.currentHousehold();
        if (cancelled) return;
        setHouseholdId(household.id);
        // ── SEPACCT `AMENDMENT_16` §A60 (`R-2`) — **DO NOT SUBSTITUTE THE MANAGED BUDGET FOR A
        //    REDACTED INCOME.** Under separate accounts the server deletes `budget.income` and
        //    marks the document; without this check the `??` fell through and every figure on this
        //    page labelled "הכנסה" — the ceiling tile, "% מההכנסה" on each cap, and the
        //    over-income warning — was silently computed against the MANAGED BUDGET instead.
        //    `null` is the page's own "not known", and it already renders that honestly.
        const redacted = household.financialBaseline?.budget?.incomeRedacted === true;
        const inc = redacted ? null : (household.financialBaseline?.budget?.income ?? household.monthlyBudgetAmount);
        setIncome(typeof inc === "number" ? inc : null);
        setIncomeRedacted(redacted);
        const { budgets } = await api.categoryBudgets(household.id);
        if (cancelled) return;
        seed(budgets);
        setLoadingData(false);
      } catch (err) {
        if (cancelled) return;
        if (redirectIfUnauthorized(err, router, pathname)) return;
        setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את תקציבי הקטגוריות.");
        setLoadingData(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer.status, viewer.hasHousehold, canManage, router, pathname]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  // 3.3.1 - focus the failing row only AFTER React has committed aria-invalid +
  // aria-describedby on it; focusing inside the submit handler lands on a field that is
  // still announced as perfectly valid.
  useEffect(() => {
    if (!invalidCap) return;
    document.getElementById(`cap-${invalidCap}`)?.focus();
  }, [invalidCap]);

  // ── derived ──────────────────────────────────────────────────────────────────
  const incomeKnown = income !== null && income > 0;
  const inc = (income ?? 0) as number;

  function desiredCap(cat: string): number | null {
    const v = local[cat];
    if (typeof v !== "string") return null;
    const raw = v.trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function serverCap(cat: string): number | null {
    return server[cat] ?? null;
  }

  const allocated = CAP_BUCKETS.reduce((sum, c) => sum + (desiredCap(c) ?? 0), 0);
  const cappedCount = CAP_BUCKETS.filter((c) => desiredCap(c) !== null).length;
  const hasChanges = CAP_BUCKETS.some((c) => desiredCap(c) !== serverCap(c));
  const overIncome = incomeKnown && allocated > inc;
  const unassigned = incomeKnown ? Math.max(0, inc - allocated) : 0;
  const overBy = incomeKnown ? Math.max(0, allocated - inc) : 0;
  const barPct = incomeKnown ? Math.min(100, (allocated / inc) * 100) : 0;

  async function handleSave() {
    // `saving` re-entry guard lives here (not on the button's `disabled`): pressing the
    // button is what sets `saving`, and disabling the focused control drops focus to <body>.
    if (!householdId || !canManage || saving) return;
    // Nothing to save - the bar is only still mounted to carry its "✓ נשמר" state.
    if (!hasChanges) return;
    // Guard a capped row left with a non-empty but non-positive value before any call.
    for (const c of CAP_BUCKETS) {
      const v = local[c];
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v.trim());
        if (!(Number.isFinite(n) && n > 0)) {
          setError(CAP_INVALID_MSG);
          // 3.3.1 - the message lives at the bottom of the caps panel, far from the
          // sticky bar that was pressed; the effect above sends focus to the row that
          // actually failed once its aria attributes are committed.
          setInvalidCap(c);
          // 4.1.3 - role="alert" fires when the alert node is INSERTED. Re-failing on the same
          // row writes an identical string into the already-mounted alert and says nothing, so
          // the alert is keyed on this attempt counter and remounts on every press.
          setCapErrorAt((n) => n + 1);
          return;
        }
      }
    }
    setSaving(true);
    setError(undefined);
    setInvalidCap(null);
    setJustSaved(false);
    try {
      const ops: Promise<unknown>[] = [];
      for (const c of CAP_BUCKETS) {
        const d = desiredCap(c);
        if (d === serverCap(c)) continue;
        ops.push(d === null ? api.removeCategoryBudget(householdId, c) : api.setCategoryBudget(householdId, c, d));
      }
      await Promise.all(ops);
      const { budgets } = await api.categoryBudgets(householdId);
      seed(budgets);
      setJustSaved(true);
      // 4.1.3 - the save bar unmounts ~1.8s later, so a live region inside it would be
      // gone before it could be read; the shared announcer carries the confirmation.
      announce("נשמר");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      if (redirectIfUnauthorized(err, router, pathname)) return;
      setError(err instanceof Error ? err.message : "לא הצלחנו לשמור. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  // 1.3.1/2.4.6 - every rendered state carries the page's single <h1>, not only the happy path.
  if (viewer.status === "loading") return <AppShell><h1 className="page-title">תקציבי קטגוריות</h1><LoadState /></AppShell>;
  if (viewer.status === "error") {
    return <AppShell><h1 className="page-title">תקציבי קטגוריות</h1><LoadState error="לא הצלחנו לטעון. נסו לרענן." /></AppShell>;
  }

  if (!canManage) {
    return (
      <AppShell>
        <h1 className="page-title">תקציבי קטגוריות</h1>
        <section className="panel">
          <p className="muted">לעריכת תקציבי קטגוריות נדרשת הרשאת ניהול של משק הבית.</p>
        </section>
      </AppShell>
    );
  }

  if (loadingData) return <AppShell><h1 className="page-title">תקציבי קטגוריות</h1><LoadState /></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">תקציבי קטגוריות</h1>
      <p className="muted" style={{ marginBottom: "var(--sp-5)" }}>
        תקרה חודשית לכל קטגוריה - זה מה שמופיע כהתקדמות בדשבורד.
      </p>

      {/* Ceiling summary — income vs. total caps */}
      <section className="panel" style={{ marginBottom: "var(--sp-5)" }}>
        {incomeRedacted && (
          // 2a — same silence, second surface. The tile reads "פרטית" and, until now, nothing said
          // whose or where. Pointer flag-gated for the same reason as on /settings/household.
          <p className="status" style={{ display: "block", marginBottom: "var(--sp-4)" }}>
            כשהחשבונות בבית מנוהלים בנפרד, אין הכנסה משותפת להשוות אליה. הסכום שנשמר קודם לא נמחק, הוא רק מפסיק להיות מוצג. התקרות עצמן עובדות כרגיל.
            {SEPACCT_UI_ENABLED && <> ההכנסה שלכם עצמכם נשמרת ב<Link href="/my-income">ההכנסה שלי</Link>.</>}
          </p>
        )}
        <div className="grid three">
          <StatTile label="הכנסה חודשית" value={incomeKnown ? nis(inc) : incomeRedacted ? "פרטית" : "לא הוגדר"} />
          <StatTile
            label="סך התקרות"
            value={nis(allocated)}
            sub={`${cappedCount} קטגוריות מוגבלות`}
            strong
          />
          {incomeKnown && (
            <StatTile
              label={overIncome ? "מעל ההכנסה" : "לא הוקצה"}
              value={nis(overIncome ? overBy : unassigned)}
              color={overIncome ? "var(--warn)" : undefined}
            />
          )}
        </div>
        {incomeKnown && (
          <div className="bar" style={{ marginTop: "var(--sp-4)" }}>
            <i style={{ width: `${barPct}%`, background: overIncome ? "var(--warn)" : "var(--teal)" }} />
          </div>
        )}
        {/* Household cross-link - moved INTO the ceiling panel with an Info cue,
            matching the design ("רוצים לעדכן הכנסות או הוצאות קבועות?"). */}
        <div
          className="muted"
          style={{
            marginTop: "var(--sp-4)",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
          }}
        >
          <Info size={15} aria-hidden style={{ flexShrink: 0 }} />
          <span>
            רוצים לעדכן הכנסות או הוצאות קבועות?{" "}
            <Link href="/settings/household" style={{ color: "var(--teal-dark)", fontWeight: 600 }}>
              פרטי משק הבית
            </Link>
          </span>
        </div>
      </section>

      {/* Cap-able categories — the 6 rows that own a unique backend bucket */}
      <section className="panel">
        {CAP_CATEGORIES.map((meta, idx) => {
          const key = meta.bucket;
          const capped = typeof local[key] === "string";
          const cap = desiredCap(key);
          const pct = incomeKnown && cap ? Math.round((cap / inc) * 100) : null;
          const isLast = idx === CAP_CATEGORIES.length - 1;
          return (
            <div
              key={key}
              className="row between"
              style={{
                gap: "var(--sp-3)",
                padding: "var(--sp-3) 0",
                borderBottom: isLast ? "none" : "1px solid var(--cream-3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minWidth: 0 }}>
                <span
                  className="cat-tile"
                  style={{ background: `color-mix(in oklab, ${meta.color} 14%, var(--cream-2))` }}
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{meta.labelHe}</div>
                  {pct !== null && (
                    <div className="muted" style={{ fontSize: 12 }}>{pct}% מההכנסה</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: "none" }}>
                {capped ? (
                  <input
                    id={`cap-${key}`}
                    className="input"
                    type="number"
                    min={1}
                    max={1000000}
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`תקרה חודשית ל${meta.labelHe}`}
                    aria-invalid={invalidCap === key || undefined}
                    aria-describedby={invalidCap === key ? CAP_ERROR_ID : undefined}
                    value={local[key] ?? ""}
                    onChange={(e) => {
                      setLocal((prev) => ({ ...prev, [key]: e.target.value }));
                      // 3.3.1 - the message must not outlive the problem it describes.
                      if (invalidCap === key) {
                        setInvalidCap(null);
                        setError(undefined);
                      }
                    }}
                    style={{ width: 116, textAlign: "left" }}
                  />
                ) : (
                  <span className="chip">ללא הגבלה</span>
                )}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setLocal((prev) => ({ ...prev, [key]: capped ? null : "" }));
                    // Switching the failing row to "ללא הגבלה" also resolves the error.
                    if (invalidCap === key) {
                      setInvalidCap(null);
                      setError(undefined);
                    }
                  }}
                >
                  {/* 2.4.6 - six rows shipped six identically-named buttons; the .sr-only
                      tail names the row without moving a pixel. */}
                  {capped ? "ללא הגבלה" : "קבע תקרה"}
                  <span className="sr-only"> ל{meta.labelHe}</span>
                </button>
              </div>
            </div>
          );
        })}
        {error && (
          <div key={capErrorAt} id={CAP_ERROR_ID} className="status error" role="alert" style={{ marginTop: "var(--sp-3)" }}>{error}</div>
        )}
      </section>

      {/* Tracking categories — the remaining display rows roll into the general
          budget; no separate backend cap exists for them (so: no cap input, no
          fabricated numbers). Honest delivery of the design's "canonical 14". */}
      <section className="panel" style={{ marginTop: "var(--sp-5)" }}>
        <div className="label" style={{ marginBottom: "var(--sp-2)" }}>קטגוריות נוספות</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: "var(--sp-3)" }}>
          מוצגות למעקב ונכללות בתקציב הכללי. תקרה נפרדת זמינה כרגע ל-{CAP_CATEGORIES.length} הקטגוריות המרכזיות שלמעלה.
        </p>
        {TRACKING_CATEGORIES.map((meta, idx) => {
          const isLast = idx === TRACKING_CATEGORIES.length - 1;
          return (
            <div
              key={meta.id}
              className="row between"
              style={{
                gap: "var(--sp-3)",
                padding: "var(--sp-3) 0",
                borderBottom: isLast ? "none" : "1px solid var(--cream-3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minWidth: 0 }}>
                <span
                  className="cat-tile"
                  style={{ background: `color-mix(in oklab, ${meta.color} 14%, var(--cream-2))`, opacity: 0.85 }}
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <div style={{ fontWeight: 600 }}>{meta.labelHe}</div>
              </div>
              <span className="chip">מעקב</span>
            </div>
          );
        })}
      </section>

      {/* "הוספת קטגוריה" (custom categories) is intentionally NOT rendered. The cap
          endpoints validate EXACTLY the backend 7-value Purchase enum (packages/validation
          `categoryBudgetCategorySchema`), so a real new category needs a backend change
          (enum + cap storage + spend aggregation). Deferred (Path A) - we do not ship a
          disabled/non-functional affordance for a feature the backend cannot persist. */}

      {/* Sticky save bar — managers only; inert when there is nothing to save */}
      {(hasChanges || justSaved) && (
        <div className="save-bar">
          {/* 2.4.3 - the button that was pressed stays mounted across the save; only its
              LABEL carries the state. Swapping it for a non-focusable "✓ נשמר" span (as
              this bar used to) dropped the keyboard user's focus to <body> on the common,
              successful path. */}
          <span className="muted">{justSaved && !hasChanges ? "" : "יש שינויים שלא נשמרו"}</span>
          {/* No `disabled`: pressing it is what sets `saving`, and disabling the
              focused button drops focus to <body> (2.4.3). handleSave guards re-entry. */}
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
            aria-busy={saving || undefined}
            aria-disabled={(justSaved && !hasChanges) || undefined}
          >
            {justSaved && !hasChanges ? "✓ נשמר" : saving ? "שומר..." : "שמירת שינויים"}
          </button>
        </div>
      )}
    </AppShell>
  );
}
