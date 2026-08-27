"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { heDate, ilsFromAgorot } from "../../lib/format";
import { isAbsent, SEPACCT_UI_ENABLED } from "../../lib/sepacct";
import {
  MOCK_HOUSEHOLD_ID, previewState, sepacctMock,
  type MyComponentsDto, type RecordComponentsDto
} from "../../lib/sepacctMock";

const TITLE = "מה שנרשם";

/** Local calendar date, not `toISOString()` — that is UTC and rolls a day early in Israel. */
function isoToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const EMPTY_COMPONENTS: MyComponentsDto = { recordedAgorot: 0, shareAgorot: 0, settledOutAgorot: 0, settledInAgorot: 0, windowOpenedAt: null };

function Component({ label, agorot }: { label: string; agorot: number }) {
  return <div className="panel"><span className="label">{label}</span><strong className="mono" dir="ltr">{ilsFromAgorot(agorot)}</strong></div>;
}

export default function MyRecordPage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const [totals, setTotals] = useState<MyComponentsDto>();
  const [list, setList] = useState<RecordComponentsDto>();
  const [range, setRange] = useState<{ from: string; to: string }>();
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "dormant") { setAbsent(true); return; }
    if (preview === "error") { setError("לא הצלחנו לטעון את הרישום. נסו שוב."); return; }
    // §4 — the totals and the list come from DIFFERENT routes over DIFFERENT windows, and merging
    // them would produce a number that is wrong. `my-components` takes no range at all; the list
    // window is the caller's, on purchaseDate, and both bounds are required.
    const to = isoToday();
    const from = `${to.slice(0, 7)}-01`;
    setRange({ from, to });
    void Promise.all([
      sepacctMock.getMyComponents(MOCK_HOUSEHOLD_ID),
      sepacctMock.getMyRecordComponents(MOCK_HOUSEHOLD_ID, from, to)
    ]).then(([components, entries]) => {
      if (preview === "empty") { setTotals(EMPTY_COMPONENTS); setList({ entries: [] }); return; }
      // The one state that is invisible until it happens: a member who left and rejoined.
      setTotals(preview === "window" ? { ...components, windowOpenedAt: "2026-06-01T00:00:00.000Z" } : components);
      setList(entries);
    }).catch((cause) => {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו לטעון את הרישום. נסו שוב.");
    });
  }, [preview]);

  if (absent) notFound();
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!totals || !list || !range) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      {/* §4 — components, never a net. Nothing here is subtracted, labelled as a balance, or coloured. */}
      <p className="muted">מוצגים רכיבים בלבד, כל אחד בפני עצמו.</p>

      <section className="panel" style={{ maxWidth: 680 }}>
        <h2>הרכיבים שלי</h2>
        {totals.windowOpenedAt
          ? <p className="status">מוצג מ־<bdi dir="ltr">{heDate(totals.windowOpenedAt)}</bdi>. מה שקדם לתאריך הזה אינו נכלל ברכיבים למטה.</p>
          : <p className="muted">כולל את כל ההיסטוריה.</p>}
        <div className="grid two">
          <Component label="נרשם" agorot={totals.recordedAgorot} />
          <Component label="החלק שלי" agorot={totals.shareAgorot} />
          <Component label="שולם ממני" agorot={totals.settledOutAgorot} />
          <Component label="שולם אליי" agorot={totals.settledInAgorot} />
        </div>
      </section>

      <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
        <h2>הוצאות בחודש הנוכחי</h2>
        <p className="muted">
          לפי תאריך ההוצאה, <bdi dir="ltr">{heDate(range.from)}</bdi> עד <bdi dir="ltr">{heDate(range.to)}</bdi>. הרשימה הזו וטווח הרכיבים למעלה אינם אותו טווח.
        </p>
        {list.entries.length === 0
          ? <p>אין הוצאות עם חלוקה בטווח הזה.</p>
          : list.entries.map((entry) => (
            <div key={entry.purchaseId} className="row between" style={{ padding: "var(--sp-3) 0", borderBottom: "1px solid var(--cream-3)" }}>
              <div>
                <Link href={`/shared-expenses?purchaseId=${entry.purchaseId}`}>{entry.merchantNameRaw?.trim() || "הוצאה משותפת"}</Link>
                <div className="muted"><bdi dir="ltr">{heDate(entry.purchaseDate)}</bdi>{entry.disputedAt ? " · סומנה כלא מוסכמת" : ""}</div>
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
