"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { SplitControl } from "../../../components/SplitControl";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { isAbsent, SEPACCT_UI_ENABLED } from "../../../lib/sepacct";
import { MOCK_HOUSEHOLD_ID, previewState, sepacctMock, type SepacctConfigDto } from "../../../lib/sepacctMock";

/** §1 — `displayName` may be "". */
const nameOf = (displayName: string) => displayName.trim() || "חבר/ה";

export default function SeparateAccountsSettingsPage() {
  // Dormant until armed: the route is registered and renders as absent, exactly as the API does.
  if (!SEPACCT_UI_ENABLED) notFound();

  const [data, setData] = useState<SepacctConfigDto>();
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "dormant") { setAbsent(true); return; }
    if (preview === "error") { setError("לא הצלחנו לטעון את ההגדרה. נסו שוב."); return; }
    if (preview === "empty") { setData({ separateAccounts: false, members: [], defaultSplit: [] }); return; }
    void sepacctMock.getConfig().then(setData).catch((cause) => {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו לטעון את ההגדרה. נסו שוב.");
    });
  }, [preview]);

  // §3 — a 404 is "not turned on", never a failure. No error panel, no empty state, no retry.
  if (absent) notFound();
  if (error) return <AppShell><h1 className="page-title">הפרדת כספים</h1><LoadState error={error} /></AppShell>;
  if (!data) return <AppShell><h1 className="page-title">הפרדת כספים</h1><LoadState /></AppShell>;

  // §1 — `members` includes children and `defaultSplit` may not name one, so the ratio is offered
  // between adults only. Picking members[0]/members[1] blind could hand a child a share.
  const adults = data.members.filter((member) => member.role !== "limited_member");
  if (adults.length < 2) {
    return (
      <AppShell>
        <h1 className="page-title">הפרדת כספים</h1>
        <section className="panel">
          <h2>נדרש עוד חבר בוגר</h2>
          <p className="muted">הבחירה נרשמה בהצטרפות. יחס החלוקה נקבע כאן אחרי ששני חברים בוגרים מצטרפים.</p>
        </section>
      </AppShell>
    );
  }

  const first = adults[0]!;
  const second = adults[1]!;
  const firstShareBp = data.defaultSplit.find((share) => share.userId === first.userId)?.shareBp ?? 5000;
  const change = (shareBp: number) => setData({ ...data, separateAccounts: true, defaultSplit: [{ userId: first.userId, shareBp }, { userId: second.userId, shareBp: 10000 - shareBp }] });
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { setData(await sepacctMock.saveConfig(MOCK_HOUSEHOLD_ID, { separateAccounts: data.separateAccounts, defaultSplit: data.defaultSplit })); }
    catch (cause) { if (isAbsent(cause)) setAbsent(true); else setError("לא הצלחנו לשמור את ההגדרה. נסו שוב."); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <h1 className="page-title">הפרדת כספים</h1>
      <section className="panel" style={{ maxWidth: 680 }}>
        <h2>איך מחלקים הוצאות משותפות</h2>
        <p className="muted">החלוקה חלה על הוצאות חדשות בלבד. הוצאה שכבר חולקה נשארת כפי שנרשמה.</p>
        <SplitControl
          first={{ userId: first.userId, displayName: nameOf(first.displayName) }}
          second={{ userId: second.userId, displayName: nameOf(second.displayName) }}
          firstShareBp={firstShareBp}
          onChange={change}
        />
        <div className="row" style={{ marginTop: "var(--sp-4)" }}>
          <button type="button" className="button" onClick={() => void save()} aria-busy={saving}>{saving ? "שומרים..." : "שמירה"}</button>
          <Link className="button secondary" href="/my-record">מה שנרשם</Link>
          <Link className="button secondary" href="/my-income">ההכנסה שלי</Link>
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
