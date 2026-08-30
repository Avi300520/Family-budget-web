"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Purchase } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { api } from "../../../lib/api";
import { CATEGORY_LABELS } from "../../../lib/categories";
import { SEPACCT_UI_ENABLED } from "../../../lib/sepacct";
import { isHouseholdManager } from "../../../lib/settingsView";
import { useViewer } from "../../../lib/useViewer";

/** Format a purchase's purchaseDate + optional time as a local time string. */
function formatPurchaseTime(p: Purchase): string {
  // purchaseDate is YYYY-MM-DD. Use createdAt (ISO) for the time component if available.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local TZ
  const purchaseIsToday = p.purchaseDate === today;

  try {
    const created = new Date(p.createdAt);
    // toLocaleTimeString does NOT throw on an unparseable date - it returns the
    // literal "Invalid Date", so the catch below never ran. Guard explicitly.
    if (Number.isNaN(created.getTime())) return p.purchaseDate;
    const timeStr = created.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (purchaseIsToday) return timeStr;
    // Not today - show short date too: "24.5  13:52"
    const [, month, day] = p.purchaseDate.split("-").map(Number);
    return `${day}.${month}  ${timeStr}`;
  } catch {
    return p.purchaseDate;
  }
}

/** Order: high-spend categories first; "other" last. */
const CATEGORY_ORDER: Record<string, number> = {
  supermarket: 0, pharmacy_health: 1, restaurants_cafes: 2,
  fuel_transport: 3, kids: 4, entertainment: 5, other: 99
};

function categoryRank(cat: string): number {
  return CATEGORY_ORDER[cat] ?? 50;
}

/**
 * ── THE DOOR (`R-1`'s stop, closed). ──────────────────────────────────────────────────────────
 *
 * A household could declare and then never split anything, because the only page that produced a
 * `purchaseId` listed only expenses that ALREADY had a split. This page has always listed every
 * household expense of the period WITH its id; it needed one link per row, not a new endpoint.
 *
 * 🔴 **THE LINK APPEARS ONLY WHERE THE SERVER WILL ACCEPT THE SPLIT. A door onto a refusal is the
 * same defect one screen along.** Every condition below is a refusal `PUT …/split` actually
 * raises, read off `household-routes.ts` and `postgres-store.ts` rather than guessed:
 *
 *   • not declared            → the route 404s (`requireSepacctSplits` → `requireDeclared`)
 *   • `limited_member`        → 403 `split.child_excluded` — and unreachable anyway: this whole
 *                               page 403s a child at `GET …/purchases/period`
 *   • not payer, not manager  → 403 "Only the payer or a household manager may change a split"
 *   • no payer on the row     → 409 `split.no_payer` (a de-attributed purchase)
 *   • recorded before the
 *     arrangement began       → 409 `split.before_arrangement`
 *
 * Scope needs no check here: `listHouseholdPurchasesForPeriod` already filters
 * `householdBudgetWhereSql()` — `expense_type = 'household' and status = 'confirmed' and
 * project_budget_id is null`, invariant #1 — so a personal or project expense never reaches this
 * list at all.
 *
 * ⚠️ THE BOUND IS `createdAt`, NOT `purchaseDate`, because the server's guard compares
 * `p.created_at <= declaredAt`. Compared as milliseconds and required to be STRICTLY greater, so
 * the sub-millisecond boundary errs toward HIDING a splittable row rather than showing an
 * unsplittable one — the safe direction, and the only one of the two that is not the defect.
 *
 * ⚠️ THE TWO-ADULT CASE IS DELIBERATELY NOT CHECKED HERE. It would cost this page a members fetch
 * on every load; a declared household has two adults by construction (the arrangement PUT refuses
 * to enable without a complete split), and the only way to lose one is a departure afterwards.
 * `/shared-expenses` already holds the roster and says so plainly in that state.
 */
function canSplit(p: Purchase, viewerUserId: string | undefined, manager: boolean, declaredAt: string | undefined): boolean {
  if (!SEPACCT_UI_ENABLED || !declaredAt || !p.userId || !viewerUserId) return false;
  if (p.userId !== viewerUserId && !manager) return false;
  const declared = new Date(declaredAt).getTime();
  const recorded = new Date(p.createdAt).getTime();
  if (Number.isNaN(declared) || Number.isNaN(recorded)) return false;
  return recorded > declared;
}

export default function SpendingBreakdownPage() {
  const viewer = useViewer();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const me = await api.me();
        if (!me.household) { setError("אין בית"); return; }
        const result = await api.listHouseholdPurchasesForPeriod(me.household.id);
        setPurchases(result.purchases);
        setPeriodStart(result.periodStart);
        setPeriodEnd(result.periodEnd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את ההוצאות.");
      }
    }
    load();
  }, []);

  // 1.3.1/2.4.6: the error and loading branches never rendered an <h1>, so the
  // page had no heading at all in those states. .sr-only keeps the pixels identical.
  if (error) return <AppShell><h1 className="sr-only">הוצאות החודש</h1><LoadState error={error} /></AppShell>;
  if (!periodStart) return <AppShell><h1 className="sr-only">הוצאות החודש</h1><LoadState /></AppShell>;

  const total = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

  // `R-1` F4 — THE REFUSAL IS CORRECT; THE SILENCE IS NOT. A non-manager who paid for nothing this
  // month sees no `חלוקה` on any row and, until this line, not one word saying why - and their
  // `/my-record` is the same all-zero page. Two surfaces, no entry point, no explanation, and the
  // conclusion available to them is that the feature does not work. Shown only when the household
  // is declared AND nothing on the page is actionable, so it never nags a reader who has a door.
  const manager = isHouseholdManager(viewer.caps);
  const anyDoor = purchases.some((p) => canSplit(p, viewer.userId, manager, viewer.separateAccountsDeclaredAt));
  const explainNoDoor = SEPACCT_UI_ENABLED && Boolean(viewer.separateAccountsDeclaredAt) && purchases.length > 0 && !anyDoor;

  // Group by category, sort purchases within each group newest-first
  const byCategory = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const cat = p.category ?? "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const sortedCategories = [...byCategory.keys()].sort((a, b) => categoryRank(a) - categoryRank(b));

  // Format period dates for display (YYYY-MM-DD → D.M.YYYY)
  function fmtDate(iso: string) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d}.${m}.${y}`;
  }

  return (
    <AppShell>
      <Link href="/dashboard" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12, textDecoration: "none" }}>
        <ArrowRight size={14} aria-hidden />
        חזרה לדשבורד
      </Link>
      <h1 className="page-title">הוצאות החודש</h1>
      <div className="muted" style={{ marginBottom: 16, fontSize: 13 }}>{fmtDate(periodStart)} - {fmtDate(periodEnd)}</div>

      {explainNoDoor && (
        <p className="muted" style={{ marginBottom: 16 }}>
          חלוקה של הוצאה נקבעת על ידי מי שרשם אותה או על ידי מנהלי הבית, ורק להוצאות שנרשמו מאז שההסדר התחיל.
        </p>
      )}

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="row between">
          <h2>סך הכל</h2>
          <div className="metric" style={{ fontSize: 22 }}>{total.toLocaleString("he-IL")}₪</div>
        </div>
      </section>

      {purchases.length === 0 ? (
        <section className="panel">
          <p className="muted">אין הוצאות בתקופה זו.</p>
        </section>
      ) : (
        sortedCategories.map((cat) => {
          const items = byCategory.get(cat)!;
          const catTotal = items.reduce((s, p) => s + p.totalAmount, 0);
          return (
            <section key={cat} className="panel" style={{ marginBottom: 12 }}>
              {/* Category header */}
              <div className="row between" style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0 }}>{CATEGORY_LABELS[cat] ?? cat}</h2>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{catTotal.toLocaleString("he-IL")}₪</span>
              </div>
              {/* Expense rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {items.map((p) => (
                  <div key={p.id} className="row between" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span className="muted" style={{ fontSize: 12, minWidth: 60 }} dir="ltr">{formatPurchaseTime(p)}</span>
                      <span>{p.merchantNameRaw ?? "הוצאה"}</span>
                      {canSplit(p, viewer.userId, manager, viewer.separateAccountsDeclaredAt) && (
                        <Link href={`/shared-expenses?purchaseId=${p.id}`} style={{ fontSize: 12 }}>חלוקה</Link>
                      )}
                    </div>
                    <span style={{ fontWeight: 600 }}>{p.totalAmount.toLocaleString("he-IL")}₪</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </AppShell>
  );
}
