"use client";

import { CheckCircle2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { HouseholdRole } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";
import { categoryLabel } from "../../../lib/categories";

// Canonical 7-bucket taxonomy, in the same order the dashboard renders.
const CATEGORY_KEYS = [
  "supermarket",
  "pharmacy_health",
  "restaurants_cafes",
  "fuel_transport",
  "kids",
  "entertainment",
  "other",
] as const;

export default function CategoryBudgetsPage() {
  const [householdId, setHouseholdId] = useState<string>();
  const [role, setRole] = useState<HouseholdRole>();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savedCaps, setSavedCaps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function load() {
    setError(undefined);
    try {
      const me = await api.me();
      setRole(me.membership?.role);
      if (!me.household) {
        setLoading(false);
        return;
      }
      setHouseholdId(me.household.id);
      // Only owner/admin may read/write caps — never fetch as a non-parent so a
      // limited/adult member who navigates here directly issues no request.
      const isParent = me.membership?.role === "owner" || me.membership?.role === "admin";
      if (isParent) {
        const { budgets } = await api.categoryBudgets(me.household.id);
        const caps: Record<string, number> = {};
        const amt: Record<string, string> = {};
        for (const b of budgets) {
          caps[b.category] = b.monthlyLimit;
          amt[b.category] = String(b.monthlyLimit);
        }
        setSavedCaps(caps);
        setAmounts(amt);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את תקציבי הקטגוריות.");
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(category: string) {
    if (!householdId) return;
    const raw = (amounts[category] ?? "").trim();
    setBusyKey(category);
    setSavedKey(null);
    setError(undefined);
    try {
      if (raw === "") {
        // Empty = clear the cap.
        await api.removeCategoryBudget(householdId, category);
        setSavedCaps((prev) => {
          const next = { ...prev };
          delete next[category];
          return next;
        });
      } else {
        const value = Number(raw);
        if (!(value > 0)) {
          setError("התקרה חייבת להיות מספר גדול מ-0.");
          setBusyKey(null);
          return;
        }
        const { budget } = await api.setCategoryBudget(householdId, category, value);
        setSavedCaps((prev) => ({ ...prev, [category]: budget.monthlyLimit }));
      }
      setSavedKey(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לשמור. נסה שוב.");
    } finally {
      setBusyKey(null);
    }
  }

  async function clear(category: string) {
    if (!householdId) return;
    setBusyKey(category);
    setSavedKey(null);
    setError(undefined);
    try {
      await api.removeCategoryBudget(householdId, category);
      setSavedCaps((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
      setAmounts((prev) => ({ ...prev, [category]: "" }));
      setSavedKey(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לנקות את התקרה.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <AppShell><p className="muted">טוען...</p></AppShell>;

  const isParent = role === "owner" || role === "admin";
  if (!isParent) {
    return (
      <AppShell>
        <h1 className="page-title">תקציבי קטגוריות</h1>
        <section className="panel">
          <p className="muted">לעריכת תקציבי קטגוריות נדרשת הרשאת בעלים או מנהל.</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="page-title">תקציבי קטגוריות</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        קבעו תקרה חודשית לכל קטגוריה. ההתקדמות מול התקרה תוצג בדשבורד. השאירו ריק כדי לא להגביל.
      </p>
      <section className="panel" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CATEGORY_KEYS.map((key) => {
            const hasCap = key in savedCaps;
            return (
              <div
                key={key}
                className="row between"
                style={{ alignItems: "flex-end", gap: 12, borderBottom: "1px solid var(--cream-3)", paddingBottom: 12 }}
              >
                <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  {categoryLabel(key)}
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={1000000}
                    dir="ltr"
                    placeholder="ללא הגבלה"
                    value={amounts[key] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </label>
                <button
                  className="button"
                  type="button"
                  disabled={busyKey === key}
                  onClick={() => save(key)}
                  style={{ padding: "8px 12px" }}
                >
                  <CheckCircle2 size={16} aria-hidden /> שמור
                </button>
                {hasCap && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busyKey === key}
                    onClick={() => clear(key)}
                    style={{ padding: "8px 12px" }}
                    title="נקה תקרה"
                    aria-label={`נקה תקרה ל${categoryLabel(key)}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {savedKey && <div className="status success" style={{ marginTop: 12 }}>נשמר.</div>}
        {error && <div className="status error" style={{ marginTop: 12 }}>{error}</div>}
      </section>
    </AppShell>
  );
}
