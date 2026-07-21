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
  // 4.1.3: the polite region must end on a RESULT, not on "" - clearing it back to
  // empty is not announced, so a successful download would finish in total silence.
  const [downloadResult, setDownloadResult] = useState("");
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
    // Re-entrancy guard: the button is no longer `disabled` while in flight (that
    // dropped focus to <body>), so this is what prevents a second export request.
    if (downloading) return;
    setDownloading(true);
    setError(undefined);
    setDownloadResult("");
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
      setDownloadResult("הקובץ ירד");
    } catch {
      setError("שגיאה בהורדה. בדוק את החיבור ונסה שוב.");
    } finally {
      setDownloading(false);
    }
  }

  // Viewer still resolving, or transient /me failure → explicit load/error state.
  // 2.4.6/1.3.1: every rendered state needs its own <h1>. These two branches are the
  // whole page, so the heading is .sr-only - the name is there, no pixels move.
  if (viewer.status === "loading") {
    return (
      <AppShell>
        <h1 className="sr-only">ייצוא הוצאות</h1>
        <LoadState />
      </AppShell>
    );
  }
  if (viewer.status === "error") {
    return (
      <AppShell>
        <h1 className="sr-only">ייצוא הוצאות</h1>
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

  // A blocked download must say WHY, and both reasons need the same single description
  // node so `aria-describedby` never dangles.
  const blockedReason = !householdId
    ? "עוד טוענים את פרטי הבית - ההורדה תיפתח בעוד רגע."
    : !month
      ? "בחרו חודש כדי להוריד את הקובץ."
      : undefined;

  return (
    <AppShell>
      <h1 className="page-title">ייצוא הוצאות</h1>
      <p className="muted" style={{ marginBottom: 20 }}>הורד קובץ CSV של כל ההוצאות לחודש נבחר.</p>

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

        {/* A blocked control must say WHY, so the "still loading the household" and
           "no month yet" windows are described rather than silently dead.
           A natively `disabled` button is not focusable and is skipped by AT, so its
           aria-describedby can never be read - aria-disabled keeps the button in the
           tab order and lets the description reach the user. The early return at the
           top of handleDownload() is what actually blocks the request.
           2.4.3: `downloading` is carried by aria-busy for the same reason - it was
           activating the button that disabled it, dropping focus to <body>. */}
        <button
          className="button"
          onClick={handleDownload}
          aria-disabled={blockedReason ? true : undefined}
          aria-busy={downloading}
          aria-describedby={blockedReason ? "export-disabled-why" : undefined}
        >
          {downloading ? "מוריד..." : (<><Download size={18} aria-hidden /> הורדת CSV</>)}
        </button>
        {blockedReason && (
          <div id="export-disabled-why" className="muted" style={{ fontSize: 13 }}>
            {blockedReason}
          </div>
        )}

        {/* 4.1.3 + 2.4.3: the failure message lives INSIDE the panel. Rendering it
           instead-of the panel unmounted the focused download button, so focus fell
           to <body> and the retry control no longer existed anywhere on the page. */}
        {error && <div className="status error" role="alert">{error}</div>}

        {/* 4.1.3: the only visible cue for the in-flight window is the label swap
           INSIDE the focused button, which screen readers do not re-announce (and
           aria-busy alone is silent in NVDA). A rendered polite region is the
           repo's existing idiom where a stable host exists - this span is mounted
           with the panel, before `downloading` ever flips. It ends on a result
           string, not on "", because clearing a region back to empty is not spoken. */}
        <span className="sr-only" role="status">{downloading ? "מוריד..." : downloadResult}</span>

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

      {/* Hidden anchor for programmatic download */}
      <a ref={anchorRef} style={{ display: "none" }} aria-hidden />
    </AppShell>
  );
}
