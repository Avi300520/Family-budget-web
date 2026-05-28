"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { api } from "../../lib/api";
import { apiBaseUrl } from "../../lib/apiBase";

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  if (!year || !m) return month;
  const d = new Date(Number(year), Number(m) - 1, 1);
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function prevMonths(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

export default function ExportPage() {
  const [month, setMonth] = useState<string>("");
  const [householdId, setHouseholdId] = useState<string>();
  const [error, setError] = useState<string>();
  const [downloading, setDownloading] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const months = prevMonths(12);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) setMonth(m);
    else if (months[0]) setMonth(months[0]);

    api.me().then((me) => {
      if (!me.household) { setError("אין לך בית פעיל."); return; }
      setHouseholdId(me.household.id);
    }).catch(() => setError("לא הצלחנו לטעון. נסה לרענן."));
  }, []);

  async function handleDownload() {
    if (!householdId || !month) return;
    setDownloading(true);
    setError(undefined);
    try {
      const apiBase = apiBaseUrl();
      const url = `${apiBase}/api/v1/households/${householdId}/export?month=${encodeURIComponent(month)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) { setError("לא הצלחנו לייצא. נסה שוב."); return; }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const anchor = anchorRef.current!;
      anchor.href = objUrl;
      anchor.download = `expenses-${month}.csv`;
      anchor.click();
      URL.revokeObjectURL(objUrl);
    } catch {
      setError("שגיאה בהורדה. בדוק את החיבור ונסה שוב.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-title">ייצוא הוצאות</h1>
      <p className="muted" style={{ marginBottom: 20 }}>הורד קובץ CSV של כל ההוצאות לחודש נבחר.</p>

      {error && <div className="status error">{error}</div>}

      {!error && (
        <div className="panel" style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form">
            <label htmlFor="month-select">בחר חודש</label>
            <select
              id="month-select"
              className="input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <button
            className="button"
            onClick={handleDownload}
            disabled={!householdId || !month || downloading}
          >
            {downloading ? "מוריד..." : "הורד CSV"}
          </button>

          <p className="muted" style={{ fontSize: 13 }}>
            הקובץ כולל: תאריך, סכום, קטגוריה, תיאור, שם חבר, סוג הוצאה, שם פרויקט.
          </p>
        </div>
      )}

      {/* Hidden anchor for programmatic download */}
      <a ref={anchorRef} style={{ display: "none" }} aria-hidden />
    </AppShell>
  );
}
