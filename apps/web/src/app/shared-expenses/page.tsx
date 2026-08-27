"use client";

import { useEffect, useState } from "react";
import { SplitControl } from "../../components/SplitControl";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { MOCK_VIEWER_ID, previewState, sepacctMock, type PurchaseAllocationDto } from "../../lib/sepacctMock";

export default function SharedExpensesPage() {
  const [allocation, setAllocation] = useState<PurchaseAllocationDto>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "error") { setError("לא הצלחנו לטעון את ההוצאה. נסו שוב."); return; }
    void sepacctMock.getAllocation().then((value) => { setAllocation(preview === "empty" ? undefined : value); setLoaded(true); }).catch(() => setError("לא הצלחנו לטעון את ההוצאה. נסו שוב."));
  }, [preview]);

  if (error) return <AppShell><h1 className="page-title">הוצאה משותפת</h1><LoadState error={error} /></AppShell>;
  if (!loaded) return <AppShell><h1 className="page-title">הוצאה משותפת</h1><LoadState /></AppShell>;
  if (!allocation) return <AppShell><h1 className="page-title">הוצאה משותפת</h1><section className="panel"><h2>עדיין לא הוגדרה חלוקה</h2><p className="muted">כשתירשם הוצאה משותפת, אפשר לקבוע לה חלוקה כאן.</p></section></AppShell>;

  const mine = allocation.shares.find((share) => share.userId === MOCK_VIEWER_ID);
  const other = allocation.shares.find((share) => share.userId !== MOCK_VIEWER_ID);
  if (!mine || !other) return <AppShell><h1 className="page-title">הוצאה משותפת</h1><LoadState error="החלוקה אינה מלאה ולכן לא נציג סכום." /></AppShell>;
  const update = (shareBp: number) => setAllocation({ ...allocation, shares: allocation.shares.map((share) => share.userId === mine.userId ? { ...share, shareBp } : { ...share, shareBp: 10000 - shareBp }) });
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { setAllocation(await sepacctMock.setAllocation(allocation.shares.map((share) => ({ userId: share.userId, shareBp: share.shareBp }))) ?? undefined); }
    catch { setError("לא הצלחנו לשמור את החלוקה. נסו שוב."); }
    finally { setSaving(false); }
  };
  const dispute = async () => setAllocation(await sepacctMock.disputeMyShare());

  return (
    <AppShell>
      <h1 className="page-title">הוצאה משותפת</h1>
      <section className="panel" style={{ maxWidth: 680 }}>
        <div className="row between"><h2>{allocation.merchantName}</h2><span className="mono" dir="ltr">{ilsFromAgorot(allocation.totalAgorot)}</span></div>
        <p className="muted">נרשם על ידי {allocation.recordedBy}</p>
        <div className="grid two" style={{ marginBottom: "var(--sp-4)" }}>
          <div className="panel"><span className="label">נרשם</span><strong className="mono" dir="ltr">{ilsFromAgorot(allocation.totalAgorot)}</strong></div>
          <div className="panel"><span className="label">חלקך</span><strong className="mono" dir="ltr">{ilsFromAgorot(mine.agorot)}</strong></div>
        </div>
        <SplitControl first={mine} second={other} firstShareBp={mine.shareBp} onChange={update} />
        {mine.previousShareBp !== undefined && <p className="muted">החלק הקודם: <bdi className="mono" dir="ltr">{(mine.previousShareBp / 100).toFixed(2)}%</bdi></p>}
        {mine.disputedAt ? <p className="status">סימנת שהחלוקה אינה מוסכמת.</p> : <button type="button" className="button secondary" onClick={() => void dispute()}>החלוקה אינה מוסכמת</button>}
        <button type="button" className="button" style={{ marginInlineStart: "var(--sp-2)" }} onClick={() => void save()} aria-busy={saving}>{saving ? "שומרים..." : "שמירת חלוקה"}</button>
      </section>
    </AppShell>
  );
}
