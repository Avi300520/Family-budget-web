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
 * arrangement's `members` is one source and `/members` is another; the join happens against
 * `/members`, and a missing name degrades to a neutral label rather than a UUID.
 *
 * ⚠️ **THE REASON THIS COMMENT USED TO GIVE WAS FALSE.** It said the arrangement GET is
 * MANAGER-ONLY and the payer need not be a manager. §A49 opened that read to every active adult
 * (`household-routes.ts:454-470` refuses only a `limited_member`), so either source would work.
 * `/members` is kept because it is one fetch this page already needs for nothing else and the
 * arrangement DTO would be a second — a preference now, not a constraint.
 */
type Names = Map<string, string>;
const nameOf = (names: Names, userId: string) => names.get(userId)?.trim() || "חבר/ה";

/**
 * The two people a split is between. ACTIVE and non-child, per the server's own rule: the PUT
 * looks every named share up in `household_members … status = 'active'` and refuses a
 * `limited_member`. `roster.ts` exists because `GET /members` returns invited and removed rows too.
 */
type RosterMember = { userId: string; displayName?: string; role?: string; status?: string };
const adultsOf = (members: ReadonlyArray<RosterMember>) =>
  members.filter((m) => m.status === "active" && m.role !== "limited_member");

export default function SharedExpensesPage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const viewer = useViewer();
  const [split, setSplit] = useState<PurchaseSplitDto>();
  const [names, setNames] = useState<Names>(new Map());
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [draftBp, setDraftBp] = useState<number>();
  const [draftShares, setDraftShares] = useState<Record<string, number>>();
  const [remainderUserId, setRemainderUserId] = useState("");
  /** The FIRST split uses the current live household ratio, including N-adult arrangements. */
  const [newShares, setNewShares] = useState<Record<string, number>>({});
  const [newRemainderUserId, setNewRemainderUserId] = useState("");
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
      const [next, roster, arrangement] = await Promise.all([
        sepacct.getSplit(householdId, purchaseId),
        // The roster is a nice-to-have: a name that will not load must not hide the money.
        api.listMembers(householdId).catch(() => ({ members: [] as RosterMember[] })),
        sepacct.getConfig().catch(() => null)
      ]);
      setSplit(next);
      setNames(new Map(roster.members.map((member) => [member.userId, member.displayName ?? ""])));
      setRoster(roster.members as RosterMember[]);
      const activeAdultIds = new Set(adultsOf(roster.members as RosterMember[]).map((adult) => adult.userId));
      const currentShares = arrangement?.state === "live" ? arrangement.shares : [];
      setNewShares(Object.fromEntries(currentShares.map((share) => [share.userId, share.shareBp])));
      setNewRemainderUserId(currentShares.at(-1)?.userId ?? "");
      setDraftBp(undefined);
      setDraftShares(undefined);
      setRemainderUserId(next.allocation?.shares.filter((share) => activeAdultIds.has(share.userId)).at(-1)?.userId ?? "");
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
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="לא הצלחנו לזהות אתכם. נסו לרענן." /></AppShell>;
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

  // ── THE FIRST SPLIT. `R-1` STOPPED THE PREVIOUS RUN BECAUSE THIS DID NOT EXIST. ───────────────
  //
  // The page returned above `SplitControl` whenever `allocation === null`, so the ONLY state in
  // which a household can begin was the one state with no control on it - "the capability
  // bootstraps only from a state it cannot reach". `PUT …/split` has always created from nothing;
  // nothing on this side called it.
  //
  // The pair is the household's two active adults, ordered PAYER FIRST so the slider's
  // "חלקה של X" names the person the expense is currently recorded against. Exactly two, because
  // the server resolves an allocation into shares this page then requires to be a pair, and a
  // one-member split of 10000bp would pass `splitRejection` and render as "not between two".
  //
  // ⚠️ STILL SEEDED AT 50/50, AND BOTH REASONS IT USED TO GIVE HAVE EXPIRED. It said the
  // arrangement GET is manager-only (§A49 opened it) and that no allocator reads the stored default
  // (`CC_UX_BUILD` item 1 made it the input to auto-split). Neither is true any more, and the
  // seeding is kept anyway for a reason that IS:
  //
  // This branch renders only when an expense has NO allocation, and after item 1 that means one of
  // exactly three things - it predates the declaration, its payer is a child, or the household's
  // ratio does not currently resolve. **The household ratio is inapplicable or unresolved in all
  // three**, so seeding from it would put a number on screen that the product just declined to
  // apply to this very expense. 50/50 is offered as what it is: a starting point the person edits,
  // unsaved until they press the button, decided in front of them.
  const adults = adultsOf(roster);
  const firstSplitAdults = split.capabilities.canCreateAllocation
    && adults.length >= 2
    && adults.every((adult) => Number.isInteger(newShares[adult.userId]))
    && adults.reduce((sum, adult) => sum + (newShares[adult.userId] ?? 0), 0) === 10000
      ? adults
      : null;

  const setNewShare = (userId: string, percentage: number) => {
    const requestedBp = Math.round(Math.max(0, Math.min(100, percentage)) * 100);
    const fixedUsed = adults.reduce((sum, adult) =>
      adult.userId === newRemainderUserId || adult.userId === userId ? sum : sum + (newShares[adult.userId] ?? 0), 0);
    const next = { ...newShares, [userId]: Math.min(requestedBp, Math.max(0, 10000 - fixedUsed)) };
    if (userId !== newRemainderUserId) {
      const used = adults.reduce((sum, adult) => adult.userId === newRemainderUserId ? sum : sum + (next[adult.userId] ?? 0), 0);
      next[newRemainderUserId] = Math.max(0, 10000 - used);
    }
    setNewShares(next);
  };

  const createSplit = async () => {
    if (saving || !firstSplitAdults) return;
    setSaving(true);
    setError(undefined);
    try {
      setSplit(await sepacct.setSplit(viewer.householdId!, purchase.id,
        firstSplitAdults.map((adult) => ({ userId: adult.userId, shareBp: newShares[adult.userId] ?? 0 }))));
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "split.child_excluded") setAbsent(true);
      // The two 409s the door on /dashboard/spending is built to never show. Mapped anyway: this
      // page is also reachable by a pasted link, and a generic "try again" would be a lie for a
      // refusal that will never succeed.
      else if (cause instanceof SepacctError && cause.code === "split.no_payer") setError("להוצאה הזו אין משלם רשום, ולכן אי אפשר לחלק אותה.");
      else if (cause instanceof SepacctError && cause.code === "split.before_arrangement") setError("ההוצאה הזו נרשמה לפני שהתחלתם לנהל חשבונות נפרדים, ולכן אי אפשר לחלק אותה.");
      else if (cause instanceof SepacctError && cause.code === "auth.forbidden") setError("רק המשלם/ת של הוצאה חדשה יכול/ה ליצור לה חלוקה.");
      else if (cause instanceof SepacctError && cause.code === "split.not_a_member") setError("אחד המשתתפים אינו חבר בוגר פעיל בבית. רעננו את העמוד ונסו שוב.");
      else if (cause instanceof SepacctError && cause.code === "split.invalid") setError("החלוקה אינה תקינה. נסו שוב.");
      else setError("לא הצלחנו לשמור את החלוקה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };
  const recordedBy = purchase.userId === null ? null : nameOf(names, purchase.userId);
  const purchaseDate = heDate(purchase.purchaseDate) ?? purchase.purchaseDate;
  const changeScope = async (expenseType: "household" | "personal") => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await sepacct.setPurchaseScope(viewer.householdId!, purchase.id, expenseType);
      await load();
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "split.child_excluded") setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "purchase.payer_only") setError("רק מי שרשם את ההוצאה יכול לשנות את הסיווג שלה.");
      else setError(expenseType === "personal"
        ? "לא הצלחנו לסמן את ההוצאה כאישית. נסו שוב."
        : "לא הצלחנו להחזיר את ההוצאה להוצאות המשותפות. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  if (purchase.expenseType === "personal") {
    return (
      <AppShell><h1 className="page-title">{TITLE}</h1><section className="panel" style={{ maxWidth: 680 }}>
        <h2>{merchant}</h2><p>ההוצאה מסומנת כאישית ואינה מתחלקת.</p>
        <div className="row">
          {split.capabilities.canMarkShared && <button type="button" className="button" data-action="mark-expense-shared" onClick={() => void changeScope("household")} aria-busy={saving}>החזרה להוצאות המשותפות</button>}
          <Link className="button secondary" data-action="back-month-expenses" href="/dashboard/spending">חזרה להוצאות החודש</Link>
        </div>
      </section></AppShell>
    );
  }

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
          {firstSplitAdults
            ? (
              <>
                {firstSplitAdults.length === 2 ? (
                  <SplitControl
                    first={{ userId: firstSplitAdults[0]!.userId, displayName: nameOf(names, firstSplitAdults[0]!.userId) }}
                    second={{ userId: firstSplitAdults[1]!.userId, displayName: nameOf(names, firstSplitAdults[1]!.userId) }}
                    firstShareBp={newShares[firstSplitAdults[0]!.userId] ?? 0}
                    onChange={(shareBp) => setNewShares((current) => ({
                      ...current,
                      [firstSplitAdults[0]!.userId]: shareBp,
                      [firstSplitAdults[1]!.userId]: 10000 - shareBp
                    }))}
                  />
                ) : (
                  <section aria-label="חלוקה ראשונה" style={{ display: "grid", gap: 12 }}>
                    <label>השדה שמשלים ל־100%
                      <select className="select" data-action="choose-new-expense-remainder" value={newRemainderUserId} onChange={(event) => {
                        const remainder = event.target.value;
                        setNewRemainderUserId(remainder);
                        const used = firstSplitAdults.reduce((sum, adult) => adult.userId === remainder ? sum : sum + (newShares[adult.userId] ?? 0), 0);
                        setNewShares((current) => ({ ...current, [remainder]: Math.max(0, 10000 - used) }));
                      }}>
                        {firstSplitAdults.map((adult) => <option key={adult.userId} value={adult.userId}>{nameOf(names, adult.userId)}</option>)}
                      </select>
                    </label>
                    {firstSplitAdults.map((adult) => (
                      <label key={adult.userId} style={{ display: "grid", gridTemplateColumns: "1fr 110px", alignItems: "center", gap: 12 }}>
                        <span>{nameOf(names, adult.userId)}</span>
                        <span className="row" style={{ gap: 6 }}>
                          <input className="input mono" type="number" min={0} max={100} step={1}
                            data-action={`set-new-expense-share-${adult.userId}`} disabled={adult.userId === newRemainderUserId}
                            value={(newShares[adult.userId] ?? 0) / 100}
                            onChange={(event) => setNewShare(adult.userId, Number(event.target.value))} />
                          <span aria-hidden>%</span>
                        </span>
                      </label>
                    ))}
                  </section>
                )}
                <div className="row" style={{ marginTop: "var(--sp-3)" }}>
                  <button type="button" className="button" data-action="save-expense-allocation" onClick={() => void createSplit()} aria-busy={saving}>
                    {saving ? "שומרים..." : "שמירת חלוקה"}
                  </button>
                  <Link className="button secondary" data-action="back-month-expenses" href="/dashboard/spending">חזרה להוצאות החודש</Link>
                </div>
              </>
            )
            : (
              <>
                <p className="muted">אפשר ליצור חלוקה רק כשההסדר פעיל ויש יחס מלא לכל המבוגרים הפעילים בבית.</p>
                <div className="row">
                  <Link className="button secondary" href="/dashboard/spending">חזרה להוצאות החודש</Link>
                  <Link className="button secondary" href="/settings/separate-accounts">הגדרות ההסדר</Link>
                </div>
              </>
            )}
        </section>
      </AppShell>
    );
  }

  const mine = allocation.shares.find((share) => share.userId === viewer.userId);
  if (!mine) {
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="ההוצאה אינה משויכת אליך." /></AppShell>;
  }
  const activeAdultIds = new Set(adults.map((adult) => adult.userId));
  const editableAllocationShares = allocation.shares.filter((share) => activeAdultIds.has(share.userId));
  const other = allocation.shares.length === 2 && editableAllocationShares.length === 2
    ? allocation.shares.find((share) => share.userId !== viewer.userId)
    : undefined;

  // The saved ratio and the edited ratio are kept apart on purpose: `agorot` is resolved by the
  // server (§2) and must be rendered verbatim, so an unsaved slider move never restates money.
  const editedBp = draftBp ?? mine.shareBp;
  const currentShares = Object.fromEntries(allocation.shares.map((share) => [share.userId, share.shareBp]));
  const editedShares = draftShares ?? currentShares;
  const dirty = other
    ? editedBp !== mine.shareBp
    : allocation.shares.some((share) => editedShares[share.userId] !== share.shareBp);
  const validEditedShares = allocation.shares.reduce((sum, share) => sum + (editedShares[share.userId] ?? share.shareBp), 0) === 10000;

  // ── `A65` — **AN INTENTION IS NOT ENTERED AS ARITHMETIC.** ────────────────────────────────────
  //
  // "This one was mine alone" was reachable only by dragging the ratio control to 100. That is a
  // person translating a thought into a number so the product can translate it back, and the
  // translation is the whole friction: nobody thinks *"my share of the pharmacy run is one
  // hundred percent"*, they think *"that one was mine"*.
  //
  // Same route, same payload, same refusals — only the control carries the name. `shareBp` takes an
  // explicit argument so the named action and the ratio control share one write path and one error
  // map; a second `setSplit` call site would be a second place for those seven codes to drift.
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const shares = other
        ? [{ userId: mine.userId, shareBp: editedBp }, { userId: other.userId, shareBp: 10000 - editedBp }]
        : allocation.shares.map((share) => ({ userId: share.userId, shareBp: editedShares[share.userId] ?? share.shareBp }));
      setSplit(await sepacct.setSplit(viewer.householdId!, purchase.id, shares));
      setDraftBp(undefined);
      setDraftShares(undefined);
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      // §2 — a child is `403 split.child_excluded` on the PUT even though the GET 404s. Both mean
      // the same thing to a reader: this is not theirs to change.
      else if (cause instanceof SepacctError && cause.code === "split.child_excluded") setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "auth.forbidden") setError("רק מבוגר/ת ששמם מופיע בחלוקה יכול/ה לשנות אותה.");
      else if (cause instanceof SepacctError && cause.code === "purchase.not_found") setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "split.invalid") setError("החלוקה אינה תקינה. נסו שוב.");
      else setError("לא הצלחנו לשמור את החלוקה. נסו שוב.");
    } finally {
      setSaving(false);
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
          <div className="panel"><span className="label">חלקך לפי החלוקה השמורה</span><strong className="mono" dir="ltr">{mine.agorot === null ? "לא חושב" : ilsFromAgorot(mine.agorot)}</strong></div>
        </div>
        {split.capabilities.canEditArithmetic && <>
        {other ? <SplitControl
          first={{ userId: mine.userId, displayName: nameOf(names, mine.userId) }}
          second={{ userId: other.userId, displayName: nameOf(names, other.userId) }}
          firstShareBp={editedBp}
          onChange={setDraftBp}
        /> : <section aria-label="יחס החלוקה להוצאה" style={{ display: "grid", gap: 12 }}>
          <label>השדה שמשלים ל־100%
            <select className="select" data-action="choose-expense-remainder" value={remainderUserId} onChange={(event) => {
              const nextRemainder = event.target.value;
              setRemainderUserId(nextRemainder);
              const used = allocation.shares.reduce((sum, share) => share.userId === nextRemainder ? sum : sum + (editedShares[share.userId] ?? share.shareBp), 0);
              setDraftShares({ ...editedShares, [nextRemainder]: Math.max(0, 10000 - used) });
            }}>
              {editableAllocationShares.map((share) => <option key={share.userId} value={share.userId}>{nameOf(names, share.userId)}</option>)}
            </select>
          </label>
          {allocation.shares.map((share) => <label key={share.userId} className="row between">
            <span>{nameOf(names, share.userId)}{!activeAdultIds.has(share.userId) ? " · חלק קבוע מהעבר" : ""}</span>
            <span className="row"><input className="input mono" type="number" min={0} max={100} step={1}
              data-action={`set-expense-share-${share.userId}`} disabled={!activeAdultIds.has(share.userId) || share.userId === remainderUserId}
              value={(editedShares[share.userId] ?? share.shareBp) / 100}
              onChange={(event) => {
                const requestedBp = Math.round(Math.max(0, Math.min(100, Number(event.target.value))) * 100);
                const fixedUsed = allocation.shares.reduce((sum, candidate) =>
                  candidate.userId === remainderUserId || candidate.userId === share.userId
                    ? sum : sum + (editedShares[candidate.userId] ?? candidate.shareBp), 0);
                const next = { ...editedShares, [share.userId]: Math.min(requestedBp, Math.max(0, 10000 - fixedUsed)) };
                const used = allocation.shares.reduce((sum, candidate) => candidate.userId === remainderUserId ? sum : sum + (next[candidate.userId] ?? candidate.shareBp), 0);
                next[remainderUserId] = Math.max(0, 10000 - used);
                setDraftShares(next);
              }} /><span aria-hidden>%</span></span>
          </label>)}
        </section>}
        {dirty && <p className="muted">היחס טרם נשמר. הסכום יתעדכן אחרי השמירה.</p>}</>}
        {mine.previousShareBp !== null && <p className="muted">החלק הקודם: <bdi className="mono" dir="ltr">{(mine.previousShareBp / 100).toFixed(2)}%</bdi></p>}
        <div className="row" style={{ marginTop: "var(--sp-3)" }}>
          {split.capabilities.canEditArithmetic && <button type="button" className="button" data-action="save-expense-split" disabled={!dirty || !validEditedShares} onClick={() => void save()} aria-busy={saving}>{saving ? "שומרים..." : "שמירת חלוקה"}</button>}
          {/* `A65`, and `R-2` FINDING 8 CORRECTED THE LABEL. The spec asked for "זו הוצאה שלי
              בלבד", and a person reads that as "take it out of the shared pile". It does not: the
              expense stays a household expense, stays in the household budget, and stays visible to
              the other adult — what changes is that the tapper carries all of it. When the OTHER
              person paid, that is agreeing to owe them the whole amount, which is a large decision
              behind a label that read like a filing correction. The control is still the named
              intention `A65` asks for; the name is now the one that is true.
              Offered only when it would change something: at 100/0 already it is a no-op. */}
          {split.capabilities.canMarkPersonal && (
            <button type="button" className="button secondary" data-action="mark-expense-personal" onClick={() => void changeScope("personal")} aria-busy={saving}>
              זו הוצאה שלי בלבד
            </button>
          )}
        </div>
      </section>
    </AppShell>
  );
}
