"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SplitControl } from "../../components/SplitControl";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { isAbsent, SEPACCT_UI_ENABLED } from "../../lib/sepacct";
import {
  MOCK_HOUSEHOLD_ID, MOCK_PURCHASE_ID, MOCK_UNSPLIT_PURCHASE_ID, MOCK_VIEWER_ID,
  previewState, sepacctMock, type PurchaseSplitDto, type SepacctMemberDto
} from "../../lib/sepacctMock";

const TITLE = "הוצאה משותפת";
const nameOf = (members: SepacctMemberDto[], userId: string) =>
  members.find((member) => member.userId === userId)?.displayName.trim() || "חבר/ה";

export default function SharedExpensesPage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const [split, setSplit] = useState<PurchaseSplitDto>();
  const [members, setMembers] = useState<SepacctMemberDto[]>([]);
  const [draftBp, setDraftBp] = useState<number>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const preview = previewState(params?.get("state") ?? null);
  // A split is always ABOUT a purchase (§6 #3); the ids come from /my-record. The `??` branch is
  // mock-only convenience so every ?state= preview is reachable, and dies with the mock.
  const purchaseId = params?.get("purchaseId") ?? (preview === "empty" ? MOCK_UNSPLIT_PURCHASE_ID : MOCK_PURCHASE_ID);

  const load = useCallback(async () => {
    try {
      const [next, config] = await Promise.all([
        sepacctMock.getSplit(MOCK_HOUSEHOLD_ID, purchaseId),
        // §6 #1 — shares carry a userId and no name. The names come from the arrangement.
        sepacctMock.getConfig()
      ]);
      setSplit(next);
      setMembers(config.members);
      setDraftBp(undefined);
      setLoaded(true);
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו לטעון את ההוצאה. נסו שוב.");
    }
  }, [purchaseId]);

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "dormant") { setAbsent(true); return; }
    if (preview === "error") { setError("לא הצלחנו לטעון את ההוצאה. נסו שוב."); return; }
    void load();
  }, [preview, load]);

  if (absent) notFound();
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!loaded || !split) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  const { purchase, allocation } = split;
  const merchant = purchase.merchantNameRaw?.trim() || TITLE;
  const recordedBy = purchase.userId === null ? null : nameOf(members, purchase.userId);

  // §2 — `allocation: null` is NORMAL for a purchase with no split rows, not a failure.
  if (!allocation) {
    return (
      <AppShell>
        <h1 className="page-title">{TITLE}</h1>
        <section className="panel" style={{ maxWidth: 680 }}>
          <h2>{merchant}</h2>
          <p className="muted"><bdi dir="ltr">{purchase.purchaseDate}</bdi>{recordedBy ? ` · נרשם על ידי ${recordedBy}` : ""}</p>
          <p>עדיין לא נקבעה חלוקה להוצאה הזו.</p>
          <Link className="button secondary" href="/settings/separate-accounts">לקבוע יחס ברירת מחדל</Link>
        </section>
      </AppShell>
    );
  }

  const mine = allocation.shares.find((share) => share.userId === MOCK_VIEWER_ID);
  const other = allocation.shares.find((share) => share.userId !== MOCK_VIEWER_ID);
  if (!mine || !other || allocation.shares.length !== 2) {
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="החלוקה אינה בין שני חברים ולכן לא נציג אותה כאן." /></AppShell>;
  }

  // The saved ratio and the edited ratio are kept apart on purpose: `agorot` is resolved by the
  // server (§2) and must be rendered verbatim, so an unsaved slider move never restates money.
  const editedBp = draftBp ?? mine.shareBp;
  const dirty = editedBp !== mine.shareBp;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      setSplit(await sepacctMock.setSplit(MOCK_HOUSEHOLD_ID, purchase.id, [
        { userId: mine.userId, shareBp: editedBp },
        { userId: other.userId, shareBp: 10000 - editedBp }
      ]));
      setDraftBp(undefined);
    } catch (cause) { if (isAbsent(cause)) setAbsent(true); else setError("לא הצלחנו לשמור את החלוקה. נסו שוב."); }
    finally { setSaving(false); }
  };

  // §6 #4 — the dispute returns nothing at all, so the allocation is re-read afterwards.
  const dispute = async () => {
    try { await sepacctMock.disputeMyShare(MOCK_HOUSEHOLD_ID, purchase.id); await load(); }
    catch (cause) { if (isAbsent(cause)) setAbsent(true); else setError("לא הצלחנו לסמן את ההסתייגות. נסו שוב."); }
  };

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className="panel" style={{ maxWidth: 680 }}>
        <div className="row between"><h2>{merchant}</h2><span className="mono" dir="ltr">{ilsFromAgorot(allocation.totalAgorot)}</span></div>
        <p className="muted"><bdi dir="ltr">{purchase.purchaseDate}</bdi>{recordedBy ? ` · נרשם על ידי ${recordedBy}` : ""}</p>
        <div className="grid two" style={{ marginBottom: "var(--sp-4)" }}>
          <div className="panel"><span className="label">נרשם</span><strong className="mono" dir="ltr">{ilsFromAgorot(allocation.totalAgorot)}</strong></div>
          <div className="panel"><span className="label">חלקך לפי החלוקה השמורה</span><strong className="mono" dir="ltr">{ilsFromAgorot(mine.agorot)}</strong></div>
        </div>
        <SplitControl
          first={{ userId: mine.userId, displayName: nameOf(members, mine.userId) }}
          second={{ userId: other.userId, displayName: nameOf(members, other.userId) }}
          firstShareBp={editedBp}
          onChange={setDraftBp}
        />
        {dirty && <p className="muted">היחס טרם נשמר. הסכום יתעדכן אחרי השמירה.</p>}
        {mine.previousShareBp !== null && <p className="muted">החלק הקודם: <bdi className="mono" dir="ltr">{(mine.previousShareBp / 100).toFixed(2)}%</bdi></p>}
        <div className="row" style={{ marginTop: "var(--sp-3)" }}>
          <button type="button" className="button" onClick={() => void save()} aria-busy={saving}>{saving ? "שומרים..." : "שמירת חלוקה"}</button>
          {mine.disputedAt ? <span className="status">סימנת שהחלוקה אינה מוסכמת.</span> : <button type="button" className="button secondary" onClick={() => void dispute()}>החלוקה אינה מוסכמת</button>}
        </div>
      </section>
    </AppShell>
  );
}
