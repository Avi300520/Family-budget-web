"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import type { PurchaseUnallocatedReason, SeparateAccountsFinancialCycle } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { heDate, ilsFromAgorot } from "../../lib/format";
import { isAbsent, SEPACCT_UI_ENABLED } from "../../lib/sepacct";
import { sepacct } from "../../lib/sepacctApi";
import { useViewer } from "../../lib/useViewer";
import styles from "../sepacct.module.css";

const REASONS: Record<PurchaseUnallocatedReason, string> = {
  child_payer: "הוצאות שילדים רשמו נכנסות להוצאות הבית ואינן מתחלקות",
  pending: "היחס מחכה למבוגר/ת נוסף/ת",
  inactive: "החלוקה הייתה כבויה",
  stalled: "יחס החלוקה דרש תיקון",
  missing_payer: "לא נשמר מי שילם",
  ineligible_payer: "המשלם/ת לא היה/תה מבוגר/ת פעיל/ה",
  allocation_failure: "החלוקה לא הושלמה"
};

export default function MyRecordPage() {
  if (!SEPACCT_UI_ENABLED) notFound();
  const viewer = useViewer();
  const [cycle, setCycle] = useState<SeparateAccountsFinancialCycle>();
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);

  useEffect(() => {
    if (viewer.status !== "ready" || !viewer.householdId) return;
    void api.budgetCurrent(viewer.householdId).then((budget) =>
      sepacct.getFinancialCycle(viewer.householdId!, budget.periodStart, budget.periodEnd)
    ).then(setCycle).catch((cause) => isAbsent(cause) ? setAbsent(true) : setError("לא הצלחנו לטעון את הרישום. נסו שוב."));
  }, [viewer.status, viewer.householdId]);

  if (absent) notFound();
  if (viewer.status === "error") return <AppShell><h1 className="page-title">מה שנרשם</h1><LoadState error="לא הצלחנו לזהות אתכם." /></AppShell>;
  if (!cycle) return <AppShell><h1 className="page-title">מה שנרשם</h1><LoadState error={error} /></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">מה שנרשם</h1>
      <p className={styles.recordIntro}>מחזור כלכלי: <bdi dir="ltr">{heDate(cycle.from)}</bdi> עד <bdi dir="ltr">{heDate(cycle.to)}</bdi>. המספרים מוצגים זה לצד זה ואינם מופחתים זה מזה.</p>
      <section className={styles.metricGrid}>
        <div className={`${styles.surface} ${styles.metricCard}`}><span className={styles.metricLabel}>נרשם על שמי</span><strong className={styles.metricValue} dir="ltr">{ilsFromAgorot(cycle.recordedAgorot)}</strong></div>
        {cycle.viewerShareAgorot !== null && <div className={`${styles.surface} ${styles.metricCard}`}><span className={styles.metricLabel}>החלק שלי</span><strong className={styles.metricValue} dir="ltr">{ilsFromAgorot(cycle.viewerShareAgorot)}</strong></div>}
      </section>
      {cycle.viewerShareAgorot === null && <p className="status">לא חושב חלק שלך במחזור הזה.</p>}
      {cycle.unallocated.map((bucket) => <p className="status warn" key={bucket.reason}>{REASONS[bucket.reason]}: <bdi dir="ltr">{ilsFromAgorot(bucket.agorot)}</bdi> ({bucket.count})</p>)}
      <section className={`${styles.surface} ${styles.editor}`}>
        <h2>הוצאות משותפות במחזור</h2>
        {cycle.entries.length === 0 ? <p>אין הוצאות שמיוחסות אליך במחזור הזה.</p> : cycle.entries.map((entry) => (
          <div className="row between" key={entry.purchaseId} style={{ padding: "12px 0", borderBottom: "1px solid var(--cream-3)" }}>
            <div><Link href={`/shared-expenses?purchaseId=${entry.purchaseId}`}>{entry.merchantName?.trim() || "הוצאה משותפת"}</Link><div className="muted"><bdi dir="ltr">{heDate(entry.purchaseDate)}</bdi></div></div>
            <div>
              {entry.recordedAgorot !== null && <>נרשם <bdi className="mono" dir="ltr">{ilsFromAgorot(entry.recordedAgorot)}</bdi></>}
              {entry.kind !== "recorded_only" && <> · חלקי <bdi className="mono" dir="ltr">{ilsFromAgorot(entry.viewerShareAgorot)}</bdi></>}
              {entry.kind === "recorded_only" && <div className="muted">
                {entry.allocationStatus === "allocated_to_others"
                  ? "ההוצאה חולקה, בלי חלק שמיוחס לך."
                  : REASONS[entry.unallocatedReason!]}
              </div>}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
