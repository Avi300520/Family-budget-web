"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { MOCK_VIEWER_ID, previewState, sepacctMock, type RecordComponentsDto } from "../../lib/sepacctMock";

export default function MyRecordPage() {
  const [data, setData] = useState<RecordComponentsDto>();
  const [error, setError] = useState<string>();
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "error") { setError("לא הצלחנו לטעון את הרישום. נסו שוב."); return; }
    void sepacctMock.getRecordComponents().then((value) => setData(preview === "empty" ? { recordedAgorot: 0, shareAgorot: 0, entries: [] } : value)).catch(() => setError("לא הצלחנו לטעון את הרישום. נסו שוב."));
  }, [preview]);

  if (error) return <AppShell><h1 className="page-title">מה שנרשם</h1><LoadState error={error} /></AppShell>;
  if (!data) return <AppShell><h1 className="page-title">מה שנרשם</h1><LoadState /></AppShell>;
  if (data.entries.length === 0) return <AppShell><h1 className="page-title">מה שנרשם</h1><section className="panel"><h2>עדיין אין רישום לחלוקה</h2><p className="muted">כשתירשם הוצאה עם חלוקה, יוצגו כאן מה שנרשם ומה חלקך.</p></section></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">מה שנרשם</h1>
      <p className="muted">מוצגים רכיבים בלבד.</p>
      <section className="panel" style={{ maxWidth: 680 }}>
        {data.entries.map((entry) => {
          const share = entry.shares.find((item) => item.userId === MOCK_VIEWER_ID);
          if (!share) return null;
          return <div key={entry.purchaseId} className="row between" style={{ padding: "var(--sp-3) 0", borderBottom: "1px solid var(--cream-3)" }}><div><strong>{entry.merchantName}</strong><div className="muted"><bdi dir="ltr">{entry.purchaseDate}</bdi></div></div><div><span>נרשם </span><bdi className="mono" dir="ltr">{ilsFromAgorot(entry.totalAgorot)}</bdi><span> · חלקך </span><bdi className="mono" dir="ltr">{ilsFromAgorot(share.agorot)}</bdi></div></div>;
        })}
      </section>
    </AppShell>
  );
}
