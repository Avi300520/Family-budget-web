"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Purchase } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { api } from "../../../lib/api";
import { CATEGORY_LABELS } from "../../../lib/categories";

/** Format a purchase's purchaseDate + optional time as a local time string. */
function formatPurchaseTime(p: Purchase): string {
  // purchaseDate is YYYY-MM-DD. Use createdAt (ISO) for the time component if available.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local TZ
  const purchaseIsToday = p.purchaseDate === today;

  try {
    const created = new Date(p.createdAt);
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

export default function SpendingBreakdownPage() {
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

  if (error) return <AppShell><LoadState error={error} /></AppShell>;
  if (!periodStart) return <AppShell><LoadState /></AppShell>;

  const total = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

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
