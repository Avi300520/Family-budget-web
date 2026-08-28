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
        <p>
          <label>
            <input type="checkbox" checked={data.separateAccounts} onChange={(event) => setEnabled(event.target.checked)} />
            {" אנחנו מנהלים חשבונות נפרדים"}
          </label>
        </p>
        {declaredAt && <p className="muted">{"ההסדר נרשם ב־"}<bdi dir="ltr">{declaredAt}</bdi>.</p>}
        {data.separateAccounts
          ? <p className="muted">הוצאות משותפות חדשות ייחלקו לפי היחס שלמטה.</p>
          : <p className="status">כיבוי עוצר את החלוקה של הוצאות חדשות. הוצאות שכבר חולקו נשארות כפי שנרשמו, וגם התאריך שבו ההסדר נרשם נשמר. אפשר להפעיל שוב בכל עת.</p>}
      </section>

      <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
        <h2>איך מחלקים הוצאות משותפות</h2>
        <p className="muted">החלוקה חלה על הוצאות חדשות בלבד. הוצאה שכבר חולקה נשארת כפי שנרשמה.</p>
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

      <section className="panel" style={{ maxWidth: 680, marginTop: "var(--sp-4)" }}>
        <h2>כך נשאל בוואטסאפ</h2>
        <p>״האם אתם מפרידים כספים?״</p>
        <p className="muted">אם כן: ״איך לחלק הוצאות משותפות? חצי חצי, או יחס אחר?״</p>
      </section>
    </AppShell>
  );
}
