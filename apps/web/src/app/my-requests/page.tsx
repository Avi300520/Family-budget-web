"use client";

import { useEffect, useState } from "react";
import type { HouseholdExpenseApproval } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { api } from "../../lib/api";

const STATUS_LABEL: Record<HouseholdExpenseApproval["status"], string> = {
  pending:  "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
  expired:  "פג תוקף"
};

// a11y 1.4.3: these are pill BACKGROUNDS behind `color:#fff` (see .role-pill).
// --amber (= --mustard #D4A23A) was 2.33:1 against white; --warn #8A6410 is 5.42:1
// and is the token the rest of the app already uses for the warn/pending family.
// (--teal 5.47, --rose/--berry 6.30, --muted/--text-2 6.24 all already pass.)
const STATUS_COLOR: Record<HouseholdExpenseApproval["status"], string> = {
  pending:  "var(--warn)",
  approved: "var(--teal)",
  rejected: "var(--rose)",
  expired:  "var(--muted)"
};

// Never render a raw Date: an unparseable timestamp printed the literal string
// "Invalid Date" into the UI (toLocaleString does not throw). Returns null - NOT "" - so the
// caller can drop the whole row: "הוגשה: " with nothing after it is a label without a value,
// the same 1.3.1 defect in a quieter form. Not the shared `heDate` because this surface needs
// the time of day (submittedAt is a full ISO timestamp, not a bare YYYY-MM-DD).
function submittedLabel(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<HouseholdExpenseApproval[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.me().then(async (me) => {
      if (!me.household) { setRequests([]); return; }
      const { requests: r } = await api.myHouseholdRequests(me.household.id);
      setRequests(r);
    }).catch(() => setError("לא הצלחנו לטעון את הבקשות. נסה לרענן."));
  }, []);

  return (
    <AppShell>
      <h1 className="page-title">הבקשות שלי</h1>
      <p className="muted" style={{ marginBottom: 20 }}>בקשות ההוצאות שהגשת לתקציב הבית - סטטוס עדכני.</p>

      {/* BATCH-GI 4.1.3 - this page does not route through LoadState, so it announced neither
          the failure nor the wait. Same roles LoadState uses: assertive for the error, polite
          for the loading state. */}
      {error && <div className="status error" role="alert">{error}</div>}

      {!requests && !error && <p className="muted" role="status">טוען...</p>}

      {requests?.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: 32 }}>
          <p className="muted">אין בקשות ממתינות ב-48 שעות האחרונות.</p>
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            כששולחים הוצאה לביתן בוואטסאפ - היא תופיע כאן עד לאישור ההורה.
          </p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((req) => {
            const submitted = submittedLabel(req.submittedAt);
            return (
            <div key={req.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {/* The pending_household_expense row predates nameType - default
                      to "על" since it's grammatically safe for both stores and products. */}
                  {req.amount.toLocaleString()} ₪ {req.merchantNameRaw ? `על ${req.merchantNameRaw}` : ""}
                </div>
                {/* Guard the WHOLE row: the label may never render without its value. */}
                {submitted && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    הוגשה: {submitted}
                  </div>
                )}
              </div>
              <span
                className="role-pill"
                style={{ backgroundColor: STATUS_COLOR[req.status], color: "#fff", fontSize: 13 }}
              >
                {STATUS_LABEL[req.status]}
              </span>
            </div>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}
