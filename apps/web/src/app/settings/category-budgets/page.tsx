"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CategoryBudget } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { api } from "../../../lib/api";
import { redirectIfUnauthorized } from "../../../lib/authGuard";
import { CATEGORY_LABELS } from "../../../lib/categories";
import { nis } from "../../../lib/format";
import { isHouseholdManager } from "../../../lib/settingsView";
import { useViewer } from "../../../lib/useViewer";

// Canonical 7-bucket taxonomy, in the same order the dashboard renders. The
// backend cap endpoint validates against EXACTLY these 7 (zod enum) — never add more.
const CATEGORY_KEYS = [
  "supermarket",
  "pharmacy_health",
  "restaurants_cafes",
  "fuel_transport",
  "kids",
  "entertainment",
  "other",
] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  supermarket: "🛒",
  pharmacy_health: "💊",
  restaurants_cafes: "🍕",
  fuel_transport: "⛽",
  kids: "🎨",
  entertainment: "🎬",
  other: "✨",
};

export default function CategoryBudgetsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const viewer = useViewer();
  const canManage = isHouseholdManager(viewer.caps);

  const [householdId, setHouseholdId] = useState<string>();
  const [income, setIncome] = useState<number | null>(null);
  // Server-loaded caps (category → monthlyLimit) — the diff baseline for save.
  const [server, setServer] = useState<Record<string, number>>({});
  // Local row state: a string (incl. "") = capped/input mode; null/absent = uncapped.
  const [local, setLocal] = useState<Record<string, string | null>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string>();
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
        const inc = household.financialBaseline?.budget?.income ?? household.monthlyBudgetAmount;
        setIncome(typeof inc === "number" ? inc : null);
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

  const allocated = CATEGORY_KEYS.reduce((sum, c) => sum + (desiredCap(c) ?? 0), 0);
  const cappedCount = CATEGORY_KEYS.filter((c) => desiredCap(c) !== null).length;
  const hasChanges = CATEGORY_KEYS.some((c) => desiredCap(c) !== serverCap(c));
  const overIncome = incomeKnown && allocated > inc;
  const unassigned = incomeKnown ? Math.max(0, inc - allocated) : 0;
  const overBy = incomeKnown ? Math.max(0, allocated - inc) : 0;
  const barPct = incomeKnown ? Math.min(100, (allocated / inc) * 100) : 0;

  async function handleSave() {
    if (!householdId || !canManage) return;
    // Guard a capped row left with a non-empty but non-positive value before any call.
    for (const c of CATEGORY_KEYS) {
      const v = local[c];
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v.trim());
        if (!(Number.isFinite(n) && n > 0)) {
          setError("התקרה חייבת להיות מספר גדול מ-0.");
          return;
        }
      }
    }
    setSaving(true);
    setError(undefined);
    setJustSaved(false);
    try {
      const ops: Promise<unknown>[] = [];
      for (const c of CATEGORY_KEYS) {
        const d = desiredCap(c);
        if (d === serverCap(c)) continue;
        ops.push(d === null ? api.removeCategoryBudget(householdId, c) : api.setCategoryBudget(householdId, c, d));
      }
      await Promise.all(ops);
      const { budgets } = await api.categoryBudgets(householdId);
      seed(budgets);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      if (redirectIfUnauthorized(err, router, pathname)) return;
      setError(err instanceof Error ? err.message : "לא הצלחנו לשמור. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  if (viewer.status === "loading") return <AppShell><LoadState /></AppShell>;
  if (viewer.status === "error") {
    return <AppShell><LoadState error="לא הצלחנו לטעון. נסו לרענן." /></AppShell>;
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

  if (loadingData) return <AppShell><LoadState /></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">תקציבי קטגוריות</h1>
      <p className="muted" style={{ marginBottom: "var(--sp-5)" }}>
        תקרה חודשית לכל קטגוריה - זה מה שמופיע כהתקדמות בדשבורד.
      </p>

      {/* Ceiling summary — income vs. total caps */}
      <section className="panel" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="grid three">
          <div>
            <div className="label">הכנסה חודשית</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              {incomeKnown ? nis(inc) : "לא הוגדר"}
            </div>
          </div>
          <div>
            <div className="label">סך התקרות</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{nis(allocated)}</div>
            <div className="muted" style={{ fontSize: 12 }}>{cappedCount} קטגוריות מוגבלות</div>
          </div>
          {incomeKnown && (
            <div>
              <div className="label">{overIncome ? "מעל ההכנסה" : "לא הוקצה"}</div>
              <div
                className="mono"
                style={{ fontSize: 20, fontWeight: 700, color: overIncome ? "var(--warn)" : undefined }}
              >
                {nis(overIncome ? overBy : unassigned)}
              </div>
            </div>
          )}
        </div>
        {incomeKnown && (
          <div className="bar" style={{ marginTop: "var(--sp-4)" }}>
            <i style={{ width: `${barPct}%`, background: overIncome ? "var(--warn)" : "var(--teal)" }} />
          </div>
        )}
      </section>

      {/* Per-category rows */}
      <section className="panel">
        {CATEGORY_KEYS.map((key, idx) => {
          const capped = typeof local[key] === "string";
          const cap = desiredCap(key);
          const pct = incomeKnown && cap ? Math.round((cap / inc) * 100) : null;
          const label = CATEGORY_LABELS[key] ?? key;
          const isLast = idx === CATEGORY_KEYS.length - 1;
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
                <span className="cat-tile" style={{ background: "var(--cream-3)" }} aria-hidden>
                  {CATEGORY_EMOJI[key]}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  {pct !== null && (
                    <div className="muted" style={{ fontSize: 12 }}>{pct}% מההכנסה</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: "none" }}>
                {capped ? (
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={1000000}
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`תקרה חודשית ל${label}`}
                    value={local[key] ?? ""}
                    onChange={(e) => setLocal((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: 116, textAlign: "left" }}
                  />
                ) : (
                  <span className="chip">ללא הגבלה</span>
                )}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setLocal((prev) => ({ ...prev, [key]: capped ? null : "" }))}
                >
                  {capped ? "ללא הגבלה" : "קבע תקרה"}
                </button>
              </div>
            </div>
          );
        })}
        {error && (
          <div className="status error" style={{ marginTop: "var(--sp-3)" }}>{error}</div>
        )}
      </section>

      <p className="muted" style={{ marginTop: "var(--sp-5)" }}>
        רוצים לעדכן הכנסות או הוצאות קבועות?{" "}
        <Link href="/settings/household" style={{ color: "var(--teal-dark)", fontWeight: 600 }}>
          פרטי משק הבית
        </Link>
      </p>

      {/* Sticky save bar — managers only; inert when there is nothing to save */}
      {(hasChanges || justSaved) && (
        <div className="save-bar">
          {justSaved && !hasChanges ? (
            <span style={{ color: "var(--pos)", fontWeight: 700 }}>✓ נשמר</span>
          ) : (
            <>
              <span className="muted">יש שינויים שלא נשמרו</span>
              <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "שומר..." : "שמירת שינויים"}
              </button>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
