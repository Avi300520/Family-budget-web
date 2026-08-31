"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { heDate, ilsFromAgorot } from "../../lib/format";
import { isAbsent, SEPACCT_UI_ENABLED } from "../../lib/sepacct";
import { sepacct, type MyComponentsDto, type RecordComponentsDto } from "../../lib/sepacctApi";
import { useViewer } from "../../lib/useViewer";

const TITLE = "מה שנרשם";

/** Local calendar date, not `toISOString()` — that is UTC and rolls a day early in Israel. */
function isoToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function Component({ label, agorot }: { label: string; agorot: number }) {
  return <div className="panel"><span className="label">{label}</span><strong className="mono" dir="ltr">{ilsFromAgorot(agorot)}</strong></div>;
}

export default function MyRecordPage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const viewer = useViewer();
  const [totals, setTotals] = useState<MyComponentsDto>();
  const [list, setList] = useState<RecordComponentsDto>();
  const [range, setRange] = useState<{ from: string; to: string }>();
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);

  useEffect(() => {
    if (viewer.status !== "ready") return;
    const householdId = viewer.householdId;
    if (!householdId) { setAbsent(true); return; }
    // §4 — the totals and the list come from DIFFERENT routes over DIFFERENT windows, and merging
    // them would produce a number that is wrong. `my-components` takes no range at all; the list
    // window is the caller's, on purchaseDate, and both bounds are required.
    const to = isoToday();
    const from = `${to.slice(0, 7)}-01`;
    setRange({ from, to });
    void Promise.all([
      sepacct.getMyComponents(householdId),
      sepacct.getMyRecordComponents(householdId, from, to)
    ]).then(([components, entries]) => {
      setTotals(components);
      setList(entries);
    }).catch((cause) => {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו לטעון את הרישום. נסו שוב.");
    });
  }, [viewer.status, viewer.householdId]);

  if (absent) notFound();
  if (viewer.status === "error") {
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="לא הצלחנו לזהות אתכם. נסו לרענן." /></AppShell>;
  }
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!totals || !list || !range) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  const windowOpenedAt = heDate(totals.windowOpenedAt);

  // ── BRIEF 2b — `חלקך 0₪` IS ARITHMETICALLY TRUE AND IS NOT AN ANSWER TO THE QUESTION ASKED. ──
  //
  // `shareAgorot` is all-history, so a zero here means no split anywhere has ever given this member
  // a share — i.e. NOTHING HAS BEEN SPLIT YET. That is the first state every declared household is
  // in, and rendering it as three ₪0.00 tiles beside a real "נרשם" figure reads as a broken page,
  // not as an empty one. `handlers.ts` says it about its own copy: "arithmetically true and
  // semantically nonsense".
  //
  // So the first state gets an EMPTY STATE — the one number that means something, and what to do
  // next — and the four components return the moment there is anything to be a component of.
  // ══ `R-1`'s STOP, AND WHAT CLOSED IT — `CC_UX_BUILD` item 1 ════════════════════════════════
  //
  // 🔴 The block that stood here said, correctly at the time: **no user of this product can create
  // the first split of any expense.** The capability bootstrapped only from a state it could not
  // reach, and its fourth clause was the root — *"turning the arrangement on writes no split rows:
  // `profile.defaultSplit` is read by nobody"*.
  //
  // **That clause is now false, and it is the only one that had to become false.** A shared expense
  // recorded by a declared household is divided at the household ratio inside the transaction that
  // writes it, so a household that has answered has allocations from its FIRST expense onward and
  // the list below is populated without anybody hunting for a way in. The door on
  // `/dashboard/spending` (run 17) remains, and is now for CHANGING a split rather than for
  // conjuring the first one.
  //
  // ⚠️ THE EMPTY STATE STAYS, AND ITS POPULATION CHANGED RATHER THAN VANISHED. It is now reached by
  // a household whose expenses all predate the declaration, whose ratio does not currently resolve
  // (a member left, or a third adult arrived), or whose only recorder is a child — none of which
  // are broken states, and all of which look identical to a person unless the page says which.
  // Kept for the lesson, which outlived its defect: three sessions of careful empty-state Hebrew
  // had been written AROUND a dead end, and no amount of copy was ever going to close it.
  // `R-1` F2 — `&& totals.recordedAgorot > 0` USED TO BE HERE AND IT DEAD-ENDED THE EXACT PERSON
  // THIS EMPTY STATE EXISTS FOR. A partner who has paid for nothing yet has recorded 0 AND share 0,
  // so the guidance was skipped and they got two ₪0.00 tiles and, measured, ZERO links in <main> -
  // no explanation and no way out. And they reach it by pressing `מה שנרשם`, the button the
  // declaration screen offers them. The `חלקך 0₪` defect this state was written to remove,
  // surviving one case over. The guidance is true whenever nothing has been split, full stop.
  const nothingSplitYet = totals.shareAgorot === 0;

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      {/* §4 — components, never a net. Nothing here is subtracted, labelled as a balance, or coloured. */}
      <p className="muted">מוצגים רכיבים בלבד, כל אחד בפני עצמו.</p>

      <section className="panel" style={{ maxWidth: 680 }}>
        <h2>הרכיבים שלי</h2>
        {windowOpenedAt
          ? <p className="status">מוצג מ־<bdi dir="ltr">{windowOpenedAt}</bdi>. מה שקדם לתאריך הזה אינו נכלל ברכיבים למטה.</p>
          : <p className="muted">כולל את כל ההיסטוריה.</p>}
        {nothingSplitYet ? (
          <>
            <div className="grid two">
              <Component label="נרשם" agorot={totals.recordedAgorot} />
            </div>
            <p style={{ marginTop: "var(--sp-3)" }}>עדיין לא חולקה אף הוצאה, ולכן אין עדיין חלק משלכם להציג.</p>
            {/* `CC_UX_BUILD` item 1 changed WHO reaches this screen, so it now names the reasons
                rather than implying the feature is simply new. All three are ordinary states, and
                they are indistinguishable to a person unless the page distinguishes them. */}
            <p className="muted">הוצאות משותפות חדשות מתחלקות מעצמן. אם לא מופיע כאן כלום, בדרך כלל זה בגלל שההוצאות נרשמו לפני שהתחלתם את ההסדר, או שיחס החלוקה עדיין לא נקבע.</p>
            {/* The next step exists now (the door on /dashboard/spending), so this says it. It does
                NOT say "pick one from the list below": that list still shows only expenses that
                already HAVE a split, so it is still empty in this exact state. Restoring the
                sentence with its original destination would have re-created the dead end with
                better grammar. `וגם ההעברות` stays OUT - SETTLE is still 0 on the live process. */}
            <p className="muted">ההוצאות ממשיכות להירשם כרגיל. הרשימה שלמטה מציגה הוצאות שכבר נקבעה בהן חלוקה, ולכן היא ריקה כרגע.</p>
            {/* `R-2` FINDING 6 — this used to say "to split an expense, open it and set the ratio"
                directly after saying expenses split themselves. A person reads two consecutive
                sentences that contradict each other as an app that does not know its own behaviour.
                It now offers the ACTION for the exception rather than restating the rule. */}
            <p>אפשר לקבוע חלוקה ידנית לכל הוצאה, מתוך <Link href="/dashboard/spending">הוצאות החודש</Link>.</p>
          </>
        ) : (
          <div className="grid two">
            <Component label="נרשם" agorot={totals.recordedAgorot} />
            <Component label="החלק שלי" agorot={totals.shareAgorot} />
            {/* `R-1` — TRANSFERS CANNOT BE RECORDED BY ANYBODY TODAY. `HOUSEHOLD_SEPARATE_ACCOUNTS_
                SETTLE_ENABLED` reads 0 on the live process, so both routes 404 and the NLP kind is
                never taught. Two tiles reading ₪0.00 for ever, with nothing a reader can do about
                them, is the same `חלקך 0₪` defect one field over - so they appear only once there
                is a transfer to show. `messages.ts` does the same thing for the same reason: it
                appends `הועבר` only when something actually moved. */}
            {(totals.settledOutAgorot > 0 || totals.settledInAgorot > 0) && (
              <>
                <Component label="שולם ממני" agorot={totals.settledOutAgorot} />
                <Component label="שולם אליי" agorot={totals.settledInAgorot} />
              </>
            )}
          </div>
        )}
      </section>

      <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
        <h2>הוצאות בחודש הנוכחי</h2>
        <p className="muted">
          לפי תאריך ההוצאה, <bdi dir="ltr">{heDate(range.from) ?? range.from}</bdi> עד <bdi dir="ltr">{heDate(range.to) ?? range.to}</bdi>. הרשימה הזו וטווח הרכיבים למעלה אינם אותו טווח.
        </p>
        {list.entries.length === 0
          ? <p>אין הוצאות עם חלוקה בטווח הזה.</p>
          : list.entries.map((entry) => (
            <div key={entry.purchaseId} className="row between" style={{ padding: "var(--sp-3) 0", borderBottom: "1px solid var(--cream-3)" }}>
              <div>
                <Link href={`/shared-expenses?purchaseId=${entry.purchaseId}`}>{entry.merchantNameRaw?.trim() || "הוצאה משותפת"}</Link>
                <div className="muted"><bdi dir="ltr">{heDate(entry.purchaseDate) ?? entry.purchaseDate}</bdi>{entry.disputedAt ? " · סומנה כלא מוסכמת" : ""}</div>
              </div>
              <div>
                <span>נרשם </span><bdi className="mono" dir="ltr">{ilsFromAgorot(entry.recordedAgorot)}</bdi>
                <span> · חלקי </span><bdi className="mono" dir="ltr">{ilsFromAgorot(entry.myShareAgorot)}</bdi>
              </div>
            </div>
          ))}
      </section>
    </AppShell>
  );
}
