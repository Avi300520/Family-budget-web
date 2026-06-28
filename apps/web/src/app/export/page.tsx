"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { apiBaseUrl } from "../../lib/apiBase";
import { useViewer } from "../../lib/useViewer";
import { canViewHouseholdMembers } from "../../lib/settingsView";

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
  const viewer = useViewer();
  // Export reaches household-wide expense data, so it is gated exactly like the
  // members roster: owner/admin/adult_member may export, limited_member may not.
  // Client-side short-circuit on top of the backend 403 - no fetch, friendly message.
  const canExport = canViewHouseholdMembers(viewer.caps);

  const [month, setMonth] = useState<string>("");
  const [householdId, setHouseholdId] = useState<string>();
  const [error, setError] = useState<string>();
  const [downloading, setDownloading] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const months = prevMonths(12);

  // Month dropdown init (role-independent) - from ?month= or the latest month.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) setMonth(m);
    else if (months[0]) setMonth(months[0]);
  }, []);

  // Resolve the household id only once the viewer is ready AND allowed to export.
  // limited_member never issues the request (the friendly gate renders instead).
  useEffect(() => {
    if (viewer.status !== "ready" || !canExport) return;
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (!me.household) { setError("אין לך בית פעיל."); return; }
        setHouseholdId(me.household.id);
      })
      .catch(() => {
        if (!cancelled) setError("לא הצלחנו לטעון. נסה לרענן.");
      });
    return () => {
      cancelled = true;
    };
  }, [viewer.status, canExport]);

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

  // Viewer still resolving, or transient /me failure → explicit load/error state.
  if (viewer.status === "loading") {
    return (
      <AppShell>
        <LoadState />
      </AppShell>
    );
  }
  if (viewer.status === "error") {
    return (
      <AppShell>
        <LoadState error="לא הצלחנו לטעון את הפרטים. נסו לרענן." />
      </AppShell>
    );
  }

  // limited_member: household-wide export is restricted - friendly Hebrew message,
  // consistent with the other gated settings screens (not a raw backend 403).
  if (!canExport) {
    return (
      <AppShell>
        <h1 className="page-title">ייצוא הוצאות</h1>
        <section className="panel">
          <p className="muted">ייצוא נתוני משק הבית זמין לחברי הבית הבוגרים בלבד.</p>
        </section>
      </AppShell>
    );
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
            {downloading ? "מוריד..." : (<><Download size={18} aria-hidden /> הורדת CSV</>)}
          </button>

          {/* What the file includes - tinted note box with header + icon */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "var(--cream-1)",
              fontSize: 13,
              color: "var(--text-1)",
              lineHeight: 1.6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontWeight: 700,
                marginBottom: 6,
                color: "var(--text-0)",
              }}
            >
              <FileText size={16} aria-hidden /> מה כולל הקובץ
            </div>
            תאריך · סכום · קטגוריה · תיאור · שם החבר · סוג ההוצאה · שם הפרויקט.
          </div>
        </div>
      )}

      {/* Hidden anchor for programmatic download */}
      <a ref={anchorRef} style={{ display: "none" }} aria-hidden />
    </AppShell>
  );
}
