"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LockKeyhole, ReceiptText } from "lucide-react";
import type { SeparateAccountsArrangement } from "@shopping-assistant/shared-types";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import { heDate } from "../../../lib/format";
import { isAbsent, SEPACCT_PERSONAL_PLAN_UI_ENABLED, SEPACCT_UI_ENABLED, SepacctError } from "../../../lib/sepacct";
import { sepacct } from "../../../lib/sepacctApi";
import { separateAccountsStateTitle } from "../../../lib/sepacctView";
import { useViewer } from "../../../lib/useViewer";
import styles from "../../sepacct.module.css";

const TITLE = "הפרדת כספים";
const pct = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
const name = (value: string) => value.trim() || "חבר/ה בבית";

function sharesOf(arrangement: SeparateAccountsArrangement) {
  return "shares" in arrangement ? arrangement.shares : [];
}

function ShareOverview({ arrangement }: { arrangement: SeparateAccountsArrangement }) {
  const shares = sharesOf(arrangement);
  if (shares.length === 0) return null;
  const displayShares = arrangement.state === "pending" && arrangement.activeAdults.length === 1
    ? [...shares, { userId: "pending", displayName: "המבוגר/ת שיצטרף/תצטרף", shareBp: 10000 - shares[0]!.shareBp }]
    : shares;
  return (
    <div className={styles.shareSection}>
      <p className={styles.shareLabel}><span>יחס החלוקה הנוכחי</span><bdi dir="ltr">100%</bdi></p>
      <div className={styles.shareBar} aria-hidden="true">
        {displayShares.map((share) => <span className={styles.shareSlice} key={share.userId} style={{ flexGrow: share.shareBp }} />)}
      </div>
      <div className={styles.shareGrid}>
        {displayShares.map((share) => (
          <div className={styles.shareCard} key={share.userId}>
            <span className={styles.shareName}>{name(share.displayName)}</span>
            <bdi className={styles.shareValue} dir="ltr">{pct(share.shareBp)}</bdi>
          </div>
        ))}
      </div>
    </div>
  );
}

function StateSummary({ arrangement }: { arrangement: SeparateAccountsArrangement }) {
  switch (arrangement.state) {
    case "absent": return null;
    case "joint": return <p>הכסף בבית מנוהל יחד.</p>;
    case "pending": return <><p>היחס נשמר ומחכה למבוגר/ת נוסף/ת בבית.</p><p className="muted">נשמר ב־<bdi dir="ltr">{heDate(arrangement.configuredAt)}</bdi></p></>;
    case "live": return <><p>הוצאות משותפות חדשות מתחלקות לפי היחס שמופיע כאן.</p><p className="muted">פעיל מ־<bdi dir="ltr">{heDate(arrangement.liveSince)}</bdi></p></>;
    case "stalled": return <><p>החלוקה האוטומטית נעצרה בעקבות שינוי בהרכב המבוגרים בבית. הוצאות חדשות נשמרות בלי חלוקה עד לתיקון היחס.</p><p className="muted">נעצר ב־<bdi dir="ltr">{heDate(arrangement.stalledAt)}</bdi></p><p className="muted">{arrangement.repairerNames.length > 0 ? `מי שיכולים לתקן את היחס: ${arrangement.repairerNames.join(" ו")}.` : "מנהלי הבית יכולים לתקן את היחס."}</p></>;
    case "inactive": return <><p>החלוקה האוטומטית כבויה. ההיסטוריה וההכנסה הפרטית שלך נשארו זמינות.</p><p className="muted">כבוי מ־<bdi dir="ltr">{heDate(arrangement.disabledAt)}</bdi></p></>;
    default: {
      const exhaustive: never = arrangement;
      return exhaustive;
    }
  }
}

function RatioEditor({ arrangement, saving, onSave }: {
  arrangement: SeparateAccountsArrangement;
  saving: boolean;
  onSave: (shares: Array<{ userId: string; shareBp: number }>) => Promise<void>;
}) {
  const adults = arrangement.activeAdults;
  const initial = useMemo(() => {
    const saved = new Map(sharesOf(arrangement).map((share) => [share.userId, share.shareBp]));
    const equal = adults.length ? Math.floor(10000 / adults.length) : 0;
    return Object.fromEntries(adults.map((adult, index) => [adult.userId, saved.get(adult.userId) ?? (index === adults.length - 1 ? 10000 - equal * index : equal)]));
  }, [arrangement, adults]);
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [remainderId, setRemainderId] = useState(adults.at(-1)?.userId ?? "");

  useEffect(() => { setValues(initial); setRemainderId(adults.at(-1)?.userId ?? ""); }, [initial, adults]);
  if (adults.length === 0) return null;

  const setShare = (userId: string, percentage: number) => {
    const requestedBp = Math.round(Math.max(0, Math.min(100, percentage)) * 100);
    const fixedUsed = adults.reduce((sum, adult) =>
      adult.userId === remainderId || adult.userId === userId ? sum : sum + (values[adult.userId] ?? 0), 0);
    const shareBp = Math.min(requestedBp, Math.max(0, 10000 - fixedUsed));
    const next = { ...values, [userId]: shareBp };
    if (adults.length > 1 && userId !== remainderId) {
      const used = adults.reduce((sum, adult) => adult.userId === remainderId ? sum : sum + (next[adult.userId] ?? 0), 0);
      next[remainderId] = Math.max(0, 10000 - used);
    }
    setValues(next);
  };
  const total = adults.reduce((sum, adult) => sum + (values[adult.userId] ?? 0), 0);
  const pendingSingle = arrangement.state === "pending" && adults.length === 1;
  const valid = (pendingSingle ? total >= 0 && total <= 10000 : total === 10000)
    && adults.every((adult) => Number.isInteger(values[adult.userId]));

  return (
    <section className={styles.ratioEditor} aria-label="יחס החלוקה">
      {adults.length >= 3 && (
        <label className={styles.remainderChoice}>השדה שמשלים ל־100%
          <select className="select" value={remainderId} data-action="choose-remainder" onChange={(event) => {
            const nextId = event.target.value;
            setRemainderId(nextId);
            const used = adults.reduce((sum, adult) => adult.userId === nextId ? sum : sum + (values[adult.userId] ?? 0), 0);
            setValues((current) => ({ ...current, [nextId]: Math.max(0, 10000 - used) }));
          }}>
            {adults.map((adult) => <option key={adult.userId} value={adult.userId}>{name(adult.displayName)}</option>)}
          </select>
        </label>
      )}
      <div className={styles.ratioRows}>
        {adults.map((adult) => (
          <label className={styles.ratioRow} key={adult.userId}>
            <span className={styles.ratioName}>{name(adult.displayName)}</span>
            <span className={styles.ratioControl}>
              <input className={`input mono ${styles.ratioInput}`} type="number" min={0} max={100} step={1}
              data-action={`set-share-${adult.userId}`} disabled={adults.length > 1 && adult.userId === remainderId}
              value={(values[adult.userId] ?? 0) / 100}
              onChange={(event) => setShare(adult.userId, Number(event.target.value))} />
              <span aria-hidden>%</span>
            </span>
          </label>
        ))}
      </div>
      {pendingSingle && <p className={`${styles.ratioTotal} muted`}>החלק שמחכה למבוגר/ת שיצטרף/תצטרף: <bdi dir="ltr">{pct(10000 - total)}</bdi></p>}
      <p className={`${styles.ratioTotal} ${valid ? "muted" : "status warn"}`} aria-live="polite">סה״כ מוגדר: <bdi dir="ltr">{pct(pendingSingle ? 10000 : total)}</bdi></p>
      <button className="button" type="button" data-action="save-ratio" disabled={!valid || saving}
        onClick={() => void onSave(adults.map((adult) => ({ userId: adult.userId, shareBp: values[adult.userId] ?? 0 })))}>
        {saving ? "שומר…" : arrangement.state === "stalled" ? "תיקון והפעלת החלוקה" : arrangement.state === "inactive" ? "הפעלת החלוקה מחדש" : "שמירת היחס"}
      </button>
    </section>
  );
}

export default function SeparateAccountsSettingsPage() {
  if (!SEPACCT_UI_ENABLED) notFound();
  const viewer = useViewer();
  const [arrangement, setArrangement] = useState<SeparateAccountsArrangement>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  const fail = useCallback((cause: unknown) => {
    if (isAbsent(cause)) setMissing(true);
    else setError(cause instanceof SepacctError && cause.code === "auth.forbidden" ? "אין לך הרשאה לבצע את השינוי הזה." : "לא הצלחנו לטעון את ההסדר. נסו שוב.");
  }, []);

  useEffect(() => {
    if (viewer.status !== "ready") return;
    if (!viewer.householdId) { setMissing(true); return; }
    void sepacct.getConfig().then(setArrangement).catch(fail);
  }, [viewer.status, viewer.householdId, fail]);

  if (missing || arrangement?.state === "absent") notFound();
  if (viewer.status === "error") return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="לא הצלחנו לזהות אתכם." /></AppShell>;
  if (!arrangement) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;

  const write = async (next: { separateAccounts: boolean; defaultSplit: Array<{ userId: string; shareBp: number }> }) => {
    if (!viewer.householdId || saving) return;
    setSaving(true); setError(undefined);
    try { setArrangement(await sepacct.saveConfig(viewer.householdId, next)); }
    catch (cause) { fail(cause); }
    finally { setSaving(false); }
  };

  const canEdit = arrangement.capabilities.canEditRatio
    && !(arrangement.state === "stalled" && arrangement.reason === "single_adult");
  const canDisable = arrangement.capabilities.canDisable;

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className={`${styles.surface} ${styles.hero}`} data-state={arrangement.state}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>כסף משותף</p>
            <h2 className={styles.heroTitle}>{separateAccountsStateTitle(arrangement.state)}</h2>
            <StateSummary arrangement={arrangement} />
          </div>
          {arrangement.state === "live" && <span className={styles.statePill}>פעיל</span>}
        </div>
        <ShareOverview arrangement={arrangement} />
        {arrangement.state === "live" && <p className={styles.note}>הוצאה שילד רושם נכנסת לסך הוצאות הבית ואינה מתחלקת ביניכם. ילדים אינם צד בחלוקה.</p>}
        {arrangement.state === "pending" && arrangement.capabilities.canInviteAdult && <Link className="button secondary" data-action="invite-adult" href="/settings/members">שליחת הזמנה</Link>}
        {arrangement.state === "stalled" && arrangement.reason === "single_adult" && arrangement.capabilities.canInviteAdult && <Link className="button secondary" data-action="invite-adult" href="/settings/members">הזמנת מבוגר/ת</Link>}
        {arrangement.state === "joint" && arrangement.capabilities.canChangeMode && (
          <button className="button" type="button" data-action="choose-separate" disabled={saving} onClick={() => {
            const adults = arrangement.activeAdults;
            const equal = adults.length ? Math.floor(10000 / adults.length) : 0;
            const shares = adults.map((adult, index) => ({ userId: adult.userId, shareBp: index === adults.length - 1 ? 10000 - equal * index : equal }));
            void write({ separateAccounts: true, defaultSplit: shares });
          }}>מעבר לניהול בנפרד</button>
        )}
      </section>
      {canEdit && (
        <section className={`${styles.surface} ${styles.editor}`} aria-label="שינוי יחס החלוקה">
          <h2 className={styles.editorTitle}>שינוי יחס החלוקה</h2>
          <p className={styles.editorSub}>היחס החדש יחול על הוצאות משותפות שיירשמו מכאן והלאה.</p>
          <RatioEditor arrangement={arrangement} saving={saving} onSave={(shares) => write({ separateAccounts: true, defaultSplit: shares })} />
        </section>
      )}
      {arrangement.capabilities.canManageOwnIncome && (
        <nav className={styles.actionGrid} aria-label="המידע שלי">
          <Link className={styles.actionCard} data-action="open-own-income" href="/my-income">
            <span className={styles.actionIcon}><LockKeyhole size={20} aria-hidden /></span>
            <span className={styles.actionText}><span className={styles.actionTitle}>{SEPACCT_PERSONAL_PLAN_UI_ENABLED ? "ההכנסה והתוכנית האישית שלי" : "ההכנסה שלי"}</span><span className={styles.actionSub}>פרטיות ורק שלך</span></span>
          </Link>
          <Link className={styles.actionCard} data-action="open-my-record" href="/my-record">
            <span className={styles.actionIcon}><ReceiptText size={20} aria-hidden /></span>
            <span className={styles.actionText}><span className={styles.actionTitle}>מה נרשם עליי</span><span className={styles.actionSub}>הוצאות והחלק שלך במחזור</span></span>
          </Link>
        </nav>
      )}
      {canDisable && (
        <section className={styles.dangerZone}>
          <p className={styles.dangerCopy}>כיבוי החלוקה עוצר חלוקה אוטומטית של הוצאות חדשות. ההיסטוריה נשארת זמינה.</p>
          <button className="button secondary" type="button" data-action="disable-arrangement" disabled={saving} onClick={() => void write({ separateAccounts: false, defaultSplit: [] })}>כיבוי החלוקה</button>
        </section>
      )}
      {error && <p className="status error" role="alert">{error}</p>}
    </AppShell>
  );
}
