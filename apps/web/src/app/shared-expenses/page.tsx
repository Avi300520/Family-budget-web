"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SplitControl } from "../../components/SplitControl";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { ilsFromAgorot } from "../../lib/format";
import { heDate } from "../../lib/format";
import { isAbsent, SEPACCT_UI_ENABLED, SepacctError } from "../../lib/sepacct";
import { sepacct, type PurchaseSplitDto } from "../../lib/sepacctApi";
import { useViewer } from "../../lib/useViewer";

const TITLE = "הוצאה משותפת";

/**
 * §6 #1 — a split share carries a `userId` and no name, so the name has to be joined in. The
 * arrangement's `members` is one source but its GET is MANAGER-ONLY (§1), and the payer of an
 * expense need not be a manager; `/members` is the roster every role can already read, so the join
 * happens against that and a missing name degrades to a neutral label rather than a UUID.
 */
type Names = Map<string, string>;
const nameOf = (names: Names, userId: string) => names.get(userId)?.trim() || "חבר/ה";

export default function SharedExpensesPage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const viewer = useViewer();
  const [split, setSplit] = useState<PurchaseSplitDto>();
  const [names, setNames] = useState<Names>(new Map());
  const [draftBp, setDraftBp] = useState<number>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  const [saving, setSaving] = useState(false);

  // A split is always ABOUT a purchase (§6 #3) and the ids come from /my-record. Without one there
  // is nothing to fetch - that is not an error and not an absence, just a page reached sideways.
  const purchaseId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("purchaseId");
  const householdId = viewer.householdId;

  const load = useCallback(async () => {
    if (!householdId || !purchaseId) return;
    try {
      const [next, roster] = await Promise.all([
        sepacct.getSplit(householdId, purchaseId),
        // The roster is a nice-to-have: a name that will not load must not hide the money.
        api.listMembers(householdId).catch(() => ({ members: [] as Array<{ userId: string; displayName?: string }> }))
      ]);
      setSplit(next);
      setNames(new Map(roster.members.map((member) => [member.userId, member.displayName ?? ""])));
      setDraftBp(undefined);
      setLoaded(true);
    } catch (cause) {
      // §3 — a child gets `404 split.not_found` on this route, the same answer a disabled feature
      // gives, deliberately. Absent, never "forbidden", never a retry.
      if (isAbsent(cause)) setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "purchase.not_found") setAbsent(true);
      else setError("לא הצלחנו לטעון את ההוצאה. נסו שוב.");
    }
  }, [householdId, purchaseId]);

  useEffect(() => {
    if (viewer.status !== "ready") return;
    if (!householdId) { setAbsent(true); return; }
    if (!purchaseId) { setLoaded(true); return; }
    void load();
  }, [viewer.status, householdId, purchaseId, load]);

  if (absent) notFound();
  if (viewer.status === "error") {
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="לא הצלחנו לזהות את החשבון. נסו לרענן." /></AppShell>;
  }
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!loaded) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  if (!purchaseId || !split) {
    return (
      <AppShell>
        <h1 className="page-title">{TITLE}</h1>
        <section className="panel" style={{ maxWidth: 680 }}>
          <h2>לא נבחרה הוצאה</h2>
          <p className="muted">חלוקה נקבעת תמיד על הוצאה מסוימת. בחרו אותה מרשימת ההוצאות שנרשמו.</p>
          <Link className="button secondary" href="/my-record">מה שנרשם</Link>
        </section>
      </AppShell>
    );
  }

  const { purchase, allocation } = split;
  const merchant = purchase.merchantNameRaw?.trim() || TITLE;
  const recordedBy = purchase.userId === null ? null : nameOf(names, purchase.userId);
  const purchaseDate = heDate(purchase.purchaseDate) ?? purchase.purchaseDate;

  // §2 — `allocation: null` is NORMAL for a purchase with no split rows, not a failure.
  if (!allocation) {
    return (
      <AppShell>
        <h1 className="page-title">{TITLE}</h1>
        <section className="panel" style={{ maxWidth: 680 }}>
          <h2>{merchant}</h2>
          <p className="muted"><bdi dir="ltr">{purchaseDate}</bdi>{recordedBy ? ` · נרשם על ידי ${recordedBy}` : ""}</p>
          {/* ── BRIEF 2b — WHAT TO DO NEXT, AND IT MUST BE SOMETHING THAT ACTUALLY DOES IT. ──
              The button here used to read "set a default ratio" and go to the arrangement screen.
              `F-3`: `profile.defaultSplit` is stored by that screen and read by no allocator —
              `flags.ts`, *"Stage 1 stores them and nothing reads them"* — so following it would
              change nothing about THIS expense and the reader would come back to the same page.
              An empty state that points at a no-op is worse than one that points at nothing. */}
          {/* `R-1` STOP - see the long note in `my-record/page.tsx`. This branch is above
              `SplitControl`, so the page cannot create the first split, and the sentence that
              stood here told the reader to come back and set the ratio: it would return them to
              this identical page. Both this and the "set a default ratio" button it replaced
              pointed at a no-op. What is left is only what is true in either ruling. */}
          <p>עדיין לא נקבעה חלוקה להוצאה הזו, ולכן היא רשומה במלואה על מי שרשם אותה.</p>
          <div className="row">
            <Link className="button secondary" href="/my-record">חזרה למה שנרשם</Link>
            <Link className="button secondary" href="/settings/separate-accounts">הגדרות ההסדר</Link>
          </div>
        </section>
      </AppShell>
    );
  }

  const mine = allocation.shares.find((share) => share.userId === viewer.userId);
  const other = allocation.shares.find((share) => share.userId !== viewer.userId);
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
    setError(undefined);
    try {
      setSplit(await sepacct.setSplit(viewer.householdId!, purchase.id, [
        { userId: mine.userId, shareBp: editedBp },
        { userId: other.userId, shareBp: 10000 - editedBp }
      ]));
      setDraftBp(undefined);
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      // §2 — a child is `403 split.child_excluded` on the PUT even though the GET 404s. Both mean
      // the same thing to a reader: this is not theirs to change.
      else if (cause instanceof SepacctError && cause.code === "split.child_excluded") setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "auth.forbidden") setError("רק מי שרשם את ההוצאה או מנהלי הבית יכולים לשנות את החלוקה.");
      else if (cause instanceof SepacctError && cause.code === "purchase.not_found") setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "split.invalid") setError("החלוקה אינה תקינה. נסו שוב.");
      else setError("לא הצלחנו לשמור את החלוקה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  // §6 #4 — the dispute returns NOTHING at all, so the allocation is re-read afterwards.
  const dispute = async () => {
    try {
      await sepacct.disputeMyShare(viewer.householdId!, purchase.id);
      await load();
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "split.child_excluded") setAbsent(true);
      else setError("לא הצלחנו לסמן את ההסתייגות. נסו שוב.");
    }
  };

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className="panel" style={{ maxWidth: 680 }}>
        <div className="row between"><h2>{merchant}</h2><span className="mono" dir="ltr">{ilsFromAgorot(allocation.totalAgorot)}</span></div>
        <p className="muted"><bdi dir="ltr">{purchaseDate}</bdi>{recordedBy ? ` · נרשם על ידי ${recordedBy}` : ""}</p>
        <div className="grid two" style={{ marginBottom: "var(--sp-4)" }}>
          <div className="panel"><span className="label">נרשם</span><strong className="mono" dir="ltr">{ilsFromAgorot(allocation.totalAgorot)}</strong></div>
          <div className="panel"><span className="label">חלקך לפי החלוקה השמורה</span><strong className="mono" dir="ltr">{ilsFromAgorot(mine.agorot)}</strong></div>
        </div>
        <SplitControl
          first={{ userId: mine.userId, displayName: nameOf(names, mine.userId) }}
          second={{ userId: other.userId, displayName: nameOf(names, other.userId) }}
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
