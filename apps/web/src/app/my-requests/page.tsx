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

const STATUS_COLOR: Record<HouseholdExpenseApproval["status"], string> = {
  pending:  "var(--amber)",
  approved: "var(--teal)",
  rejected: "var(--rose)",
  expired:  "var(--muted)"
};

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

      {error && <div className="status error">{error}</div>}

      {!requests && !error && <p className="muted">טוען...</p>}

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
          {requests.map((req) => (
            <div key={req.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {/* The pending_household_expense row predates nameType - default
                      to "על" since it's grammatically safe for both stores and products. */}
                  {req.amount.toLocaleString()} ₪ {req.merchantNameRaw ? `על ${req.merchantNameRaw}` : ""}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  הוגשה: {new Date(req.submittedAt).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <span
                className="role-pill"
                style={{ backgroundColor: STATUS_COLOR[req.status], color: "#fff", fontSize: 13 }}
              >
                {STATUS_LABEL[req.status]}
              </span>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}
