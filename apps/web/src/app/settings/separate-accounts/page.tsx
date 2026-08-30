"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SplitControl } from "../../../components/SplitControl";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { heDate } from "../../../lib/format";
import { isAbsent, SEPACCT_UI_ENABLED, SepacctError } from "../../../lib/sepacct";
import { sepacct, type SepacctConfigDto } from "../../../lib/sepacctApi";
import { useViewer } from "../../../lib/useViewer";

const TITLE = "הפרדת כספים";

/** §1 — `displayName` may be "". */
const nameOf = (displayName: string) => displayName.trim() || "חבר/ה";

/**
 * ── BRIEF 2c + 2d — WHAT DECLARING ACTUALLY DOES, AND NOTHING ELSE. ──────────────────────────
 *
 * The wizard no longer declares, so THIS is the only door into the arrangement, and until now it
 * opened on a bare checkbox: a person could tick it without being told a single consequence, and
 * the one consequence it did state afterwards was false.
 *
 * ONE list, rendered TWICE — before the box is ticked, so nobody agrees to something they were not
 * told, and again after the household has declared, so the surface they declared on shows what
 * changed. The second rendering is the whole of 2c: the arrangement's only outward evidence is the
 * weekly summary, that summary is a SUNDAY fan-out, and a family that declared on a Monday would
 * otherwise watch a product that behaves identically for six days after being told it changed.
 *
 * 🔴 EVERY CLAUSE MEASURED AGAINST THE DEPLOYED BACKEND (`41680ca`), NOT AGAINST THE SPEC:
 *   1. `stripSharedIncomeUnderSeparateAccounts` keys on the raw arrangement and deletes
 *      `budget.income` from EVERY read; `carryOwnIncome` carries the STORED key back verbatim on a
 *      refused write, so "not deleted, only hidden" is true and reversible — turning the
 *      arrangement off un-strips the same figure.
 *   2. `F-3`, and it is still the sharpest thing on this screen. `profile.defaultSplit` is written
 *      by this route and read by exactly ONE surface — the arrangement DTO this page renders.
 *      `flags.ts` says it plainly: *"Stage 1 stores them and nothing reads them."* The line this
 *      list replaced promised *"new shared expenses will be split according to the ratio below"*,
 *      which is the same false promise `F-3` already took out of the WhatsApp notice once.
 *   3. `apps/workers/src/index.ts` — `if (now.getUTCDay() !== 0) return;`, 06:00–10:00 UTC. Sunday,
 *      and no other day. So the notice's one true promise is up to six days from being visible.
 *   4. The fan-out at `household-routes.ts` skips `peer.userId === auth.user.id`: **the actor is
 *      excluded.** "Both sides are notified" — which the onboarding step used to say — is false for
 *      the one person reading this screen.
 */
const WHAT_CHANGES: ReadonlyArray<string> = [
  "ההכנסה המשותפת מפסיקה להופיע במסכי הבית. הסכום שכבר נשמר אינו נמחק, הוא רק מפסיק להיות מוצג, וחוזר אם מכבים את ההסדר.",
  "מכאן כל אחד שומר את ההכנסה שלו בעמוד ״ההכנסה שלי״, והיא נראית רק לו.",
  // `R-1` — the second sentence is the load-bearing one and it stays; the first used to name the
  // expense page as where a split is set, which no reader can currently reach. Stated as a fact
  // about the mechanism, not as an instruction to go and do it.
  "שום הוצאה לא מתחלקת מעצמה, גם לא לפי היחס שנקבע כאן. חלוקה נקבעת על כל הוצאה בנפרד.",
  "הסיכום השבועי שמגיע בוואטסאפ יציג רק את ההוצאות שלכם. הוא נשלח בימי ראשון, אז זה ייראה בפעם הבאה שהוא מגיע.",
  "בן או בת הזוג יקבלו הודעה בוואטסאפ על ההפעלה ועל הכיבוי. אתם לא מקבלים אותה, כי אתם עושים את השינוי כאן."
];

function WhatChanges({ heading, lead }: { heading: string; lead: string }) {
  return (
    <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
      <h2>{heading}</h2>
      <p className="muted">{lead}</p>
      <ul style={{ margin: 0, paddingInlineStart: "1.2em", display: "grid", gap: "var(--sp-2)" }}>
        {WHAT_CHANGES.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </section>
  );
}

export default function SeparateAccountsSettingsPage() {
  // Dormant until armed: the route is registered and renders as absent, exactly as the API does.
  if (!SEPACCT_UI_ENABLED) notFound();

  const viewer = useViewer();
  const [data, setData] = useState<SepacctConfigDto>();
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  // §1 — a non-manager is 403 `auth.forbidden` here, which is NOT the dormant 404 and must not be
  // rendered as one: the feature exists, this reader is simply not the one who configures it.
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);

  const fail = useCallback((cause: unknown) => {
    if (isAbsent(cause)) setAbsent(true);
    else if (cause instanceof SepacctError && cause.code === "auth.forbidden") setForbidden(true);
    else setError("לא הצלחנו לטעון את ההגדרה. נסו שוב.");
  }, []);

  useEffect(() => {
    if (viewer.status !== "ready") return;
    // §1 — the GET is keyed `current`, not by id, so it needs no household from the viewer. The
    // PUT below does, and a user with no household has no arrangement to configure.
    if (!viewer.householdId) {
      setAbsent(true);
      return;
    }
    void sepacct.getConfig().then(setData).catch(fail);
  }, [viewer.status, viewer.householdId, fail]);

  // §3 — a 404 is "not turned on", never a failure. No error panel, no empty state, no retry.
  if (absent) notFound();
  if (forbidden) {
    return (
      <AppShell>
        <h1 className="page-title">{TITLE}</h1>
        <section className="panel" style={{ maxWidth: 680 }}>
          <h2>ההגדרה בידי מנהלי הבית</h2>
          <p className="muted">רק מנהלי הבית קובעים את ההסדר ואת יחס החלוקה. אפשר לראות את מה שנרשם עליכם ואת ההכנסה שלכם.</p>
          <div className="row">
            <Link className="button secondary" href="/my-record">מה שנרשם</Link>
            <Link className="button secondary" href="/my-income">ההכנסה שלי</Link>
          </div>
        </section>
      </AppShell>
    );
  }
  if (viewer.status === "error") {
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="לא הצלחנו לזהות את החשבון. נסו לרענן." /></AppShell>;
  }
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!data) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  // §1 — `members` includes children and `defaultSplit` may not name one, so the ratio is offered
  // between adults only. Picking members[0]/members[1] blind could hand a child a share.
  const adults = data.members.filter((member) => member.role !== "limited_member");
  const first = adults[0];
  const second = adults[1];
  const pair = Boolean(first && second);
  const firstShareBp = (first && data.defaultSplit.find((share) => share.userId === first.userId)?.shareBp) ?? 5000;
  const declaredAt = heDate(viewer.separateAccountsDeclaredAt);

  const change = (shareBp: number) =>
    setData({
      ...data,
      defaultSplit: first && second ? [{ userId: first.userId, shareBp }, { userId: second.userId, shareBp: 10000 - shareBp }] : data.defaultSplit
    });

  // The OFF direction is the SAME route, the same form and the same button as ON: the wire takes
  // `separateAccounts: false` explicitly, and §1 accepts a stale or empty split alongside it. An
  // arrangement one partner can start and neither can stop is the asymmetry this screen must not
  // have, so switching it off stays reachable even when the second adult is gone and ON is not.
  const setEnabled = (separateAccounts: boolean) => setData({ ...data, separateAccounts });

  const blocked = data.separateAccounts && !pair;
  // 2c — "מה השתנה" is a claim about the STORED arrangement, so it needs the server's own stamp and
  // not the checkbox: an unsaved tick would otherwise announce a change that has not happened.
  const declared = data.separateAccounts && Boolean(declaredAt);

  const save = async () => {
    if (saving || blocked) return;
    setSaving(true);
    setError(undefined);
    try {
      setData(await sepacct.saveConfig(viewer.householdId!, { separateAccounts: data.separateAccounts, defaultSplit: data.defaultSplit }));
      // The server mints the declaration instant on the way through, so re-read /me and show the
      // stored date rather than a guess.
      viewer.retry();
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      else if (cause instanceof SepacctError && cause.code === "split.not_a_member") setError("אחד המשתתפים אינו חבר בוגר פעיל בבית. רעננו את העמוד ונסו שוב.");
      else if (cause instanceof SepacctError && cause.code === "split.invalid") setError("יחס החלוקה אינו תקין. שני החלקים יחד חייבים להסתכם ב-100%.");
      else if (cause instanceof SepacctError && cause.code === "auth.forbidden") setForbidden(true);
      else setError("לא הצלחנו לשמור את ההגדרה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className="panel" style={{ maxWidth: 680 }}>
        <h2>ההסדר של הבית</h2>
        {/* 2d — the entry point. This is the ONLY place a household can start, so the question is
            answered here before the control is offered, not after it is used. */}
        <p>בהסדר הזה כל אחד רואה את החלק שלו בהוצאה משותפת, וההכנסה של כל אחד נשארת פרטית.</p>
        <p>
          <label>
            <input type="checkbox" checked={data.separateAccounts} onChange={(event) => setEnabled(event.target.checked)} />
            {" אנחנו מנהלים חשבונות נפרדים"}
          </label>
        </p>
        {declaredAt && <p className="muted">{"ההסדר נרשם ב־"}<bdi dir="ltr">{declaredAt}</bdi>.</p>}
        {/* 🔴 `F-3` — the line that stood here said "new shared expenses will be split according to
            the ratio below". Nothing in this product does that, and the ratio is stored and read by
            nobody. The consequences now live in one measured list, in BOTH states. */}
        {!data.separateAccounts && (
          <p className="status">כיבוי עוצר את היכולת לקבוע חלוקה על הוצאות חדשות. הוצאות שכבר חולקו נשארות כפי שנרשמו, וגם התאריך שבו ההסדר נרשם נשמר. אפשר להפעיל שוב בכל עת.</p>
        )}
      </section>

      {/* 2c — after declaring, the surface they declared on says what changed. Before declaring,
          the same list is what they are agreeing to. The heading is the only difference. */}
      {declared
        ? <WhatChanges heading="מה השתנה" lead="ההסדר פעיל. אלה הדברים שהשתנו בפועל, ומתי כל אחד מהם נראה." />
        : <WhatChanges heading="מה קורה כשמפעילים" lead="כדאי לקרוא לפני שמסמנים. אלה כל השינויים, ואין אחרים." />}

      <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
        <h2>איך מחלקים הוצאות משותפות</h2>
        {/* `F-3` again: this ratio is a DEFAULT that no allocator reads. Saying it "applies to new
            expenses" is the same promise, one panel down, and it was equally untrue. */}
        <p className="muted">היחס נשמר כברירת המחדל של הבית. הוא אינו מוחל מעצמו על אף הוצאה, וכל הוצאה נחלקת בנפרד.</p>
        {first && second
          ? <SplitControl
              first={{ userId: first.userId, displayName: nameOf(first.displayName) }}
              second={{ userId: second.userId, displayName: nameOf(second.displayName) }}
              firstShareBp={firstShareBp}
              onChange={change}
              disabled={!data.separateAccounts}
            />
          : <p>יחס החלוקה נקבע כאן אחרי ששני חברים בוגרים מצטרפים. את ההסדר עצמו אפשר לכבות גם עכשיו.</p>}
        {blocked && <p className="status" role="alert">כדי להפעיל את ההסדר דרושים שני חברים בוגרים. לכבות אפשר תמיד.</p>}
        <div className="row" style={{ marginTop: "var(--sp-4)" }}>
          {/* Never `disabled` on a control that its own activation disables (2.4.3): aria-busy plus
              the re-entrancy guard above, so focus is never dropped to <body> mid-save. */}
          <button type="button" className="button" onClick={() => void save()} aria-busy={saving} aria-disabled={blocked || undefined}>
            {saving ? "שומרים..." : "שמירה"}
          </button>
          <Link className="button secondary" href="/my-record">מה שנרשם</Link>
          <Link className="button secondary" href="/my-income">ההכנסה שלי</Link>
        </div>
      </section>

      {/* 🔴 `R-1` — A PANEL HEADED "כך נשאל בוואטסאפ" STOOD HERE, QUOTING TWO QUESTIONS THE BOT
          ASKS. IT ASKS NEITHER. `grep -rn "מפרידים כספים\|הפרדת כספים" apps/api/src` returns
          nothing, and the complete set of sepacct message builders in `messages.ts` is the two
          notices, the components line, the conclusion line, the balance reply and the
          nothing-recorded line. There is no ask, and there is no plan in this release to add one.

          It cost twice over: a reader could leave this screen believing the decision would come
          back to them in WhatsApp - so they would wait for a message that never arrives - and its
          second line re-promised the very thing `F-3` had already been taken out of the notice
          for, that a ratio governs how expenses divide. Deleted rather than reworded: there is no
          true version of a panel about a conversation that does not happen. */}
    </AppShell>
  );
}
