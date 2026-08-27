"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SplitControl } from "../../../components/SplitControl";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { previewState, sepacctMock, type SepacctConfigDto } from "../../../lib/sepacctMock";

export default function SeparateAccountsSettingsPage() {
  const [data, setData] = useState<SepacctConfigDto>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "error") { setError("לא הצלחנו לטעון את ההגדרה. נסו שוב."); return; }
    if (preview === "empty") { setData({ separateAccounts: false, members: [], defaultSplit: [] }); return; }
    void sepacctMock.getConfig().then(setData).catch(() => setError("לא הצלחנו לטעון את ההגדרה. נסו שוב."));
  }, [preview]);

  if (error) return <AppShell><h1 className="page-title">הפרדת כספים</h1><LoadState error={error} /></AppShell>;
  if (!data) return <AppShell><h1 className="page-title">הפרדת כספים</h1><LoadState /></AppShell>;
  if (data.members.length < 2) {
    return <AppShell><h1 className="page-title">הפרדת כספים</h1><section className="panel"><h2>נדרש עוד חבר בוגר</h2><p className="muted">אפשר להפעיל את ההפרדה עכשיו. חלוקה מדויקת נקבעת אחרי ששני חברים בוגרים מצטרפים.</p><button type="button" className="button" onClick={() => setData({ ...data, separateAccounts: true })}>להפעיל הפרדה</button></section></AppShell>;
  }

  const first = data.members[0]!;
  const second = data.members[1]!;
  const firstShareBp = data.defaultSplit.find((share) => share.userId === first.userId)?.shareBp ?? 5000;
  const change = (shareBp: number) => setData({ ...data, separateAccounts: true, defaultSplit: [{ userId: first.userId, shareBp }, { userId: second.userId, shareBp: 10000 - shareBp }] });
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { setData(await sepacctMock.saveConfig({ separateAccounts: data.separateAccounts, defaultSplit: data.defaultSplit })); }
    catch { setError("לא הצלחנו לשמור את ההגדרה. נסו שוב."); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <h1 className="page-title">הפרדת כספים</h1>
      <section className="panel" style={{ maxWidth: 680 }}>
        <h2>איך מחלקים הוצאות משותפות</h2>
        <p className="muted">החלוקה חלה על הוצאות חדשות בלבד. הוצאה שכבר חולקה נשארת כפי שנרשמה.</p>
        <SplitControl first={first} second={second} firstShareBp={firstShareBp} onChange={change} />
        <div className="row" style={{ marginTop: "var(--sp-4)" }}>
          <button type="button" className="button" onClick={() => void save()} aria-busy={saving}>{saving ? "שומרים..." : "שמירה"}</button>
          <Link className="button secondary" href="/shared-expenses">לחלוקת הוצאה</Link>
          <Link className="button secondary" href="/my-income">ההכנסה שלי</Link>
          <Link className="button secondary" href="/my-record">מה שנרשם</Link>
        </div>
      </section>
      <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
        <h2>כך נשאל בוואטסאפ</h2>
        <p>״האם אתם מפרידים כספים?״</p>
        <p className="muted">אם כן: ״איך לחלק הוצאות משותפות? חצי חצי, או יחס אחר?״</p>
      </section>
    </AppShell>
  );
}
