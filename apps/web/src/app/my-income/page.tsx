"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { agorotFromInput, inputFromAgorot, isAbsent, SEPACCT_PERSONAL_PLAN_UI_ENABLED, SEPACCT_UI_ENABLED, SepacctError } from "../../lib/sepacct";
import { sepacct } from "../../lib/sepacctApi";
import { useViewer } from "../../lib/useViewer";
import styles from "../sepacct.module.css";

const TITLE = "ההכנסה שלי";

export default function MyIncomePage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const viewer = useViewer();
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [privatePlan, setPrivatePlan] = useState<number | null>(null);
  const [privatePlanValue, setPrivatePlanValue] = useState("");
  const [privatePlanAvailable, setPrivatePlanAvailable] = useState(false);
  const [savingPrivatePlan, setSavingPrivatePlan] = useState(false);

  useEffect(() => {
    if (viewer.status !== "ready") return;
    if (!viewer.householdId) { setAbsent(true); return; }
    void sepacct.getOwnIncome(viewer.householdId).then((data) => {
      // §3 — `monthlyAgorot` is explicitly null when unset, and null for a child. Never absent.
      setSaved(data.monthlyAgorot);
      setValue(inputFromAgorot(data.monthlyAgorot));
      setLoaded(true);
    }).catch((cause) => {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו לטעון את ההכנסה. נסו שוב.");
    });
    if (SEPACCT_PERSONAL_PLAN_UI_ENABLED) {
      void sepacct.getOwnPrivatePlan(viewer.householdId).then((data) => {
        setPrivatePlan(data.monthlyAgorot);
        setPrivatePlanValue(inputFromAgorot(data.monthlyAgorot));
        setPrivatePlanAvailable(true);
      }).catch((cause) => {
        // A household that has not selected separate money has no private-plan resource. That is
        // an ordinary state, not a dashboard-breaking error; all other failures remain visible
        // through the primary income surface rather than pretending that a save succeeded.
        if (!isAbsent(cause)) setError("לא הצלחנו לטעון את התוכנית האישית. נסו שוב.");
      });
    }
  }, [viewer.status, viewer.householdId]);

  if (absent) notFound();
  if (viewer.status === "error") {
    return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error="לא הצלחנו לזהות אתכם. נסו לרענן." /></AppShell>;
  }
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!loaded) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  const parsed = agorotFromInput(value);
  const invalid = !parsed.ok;
  const save = async () => {
    if (saving || !parsed.ok) return;
    setSaving(true);
    setError(undefined);
    // An empty field is `null` — the wire's "clear it" — not an omitted field (§3).
    try {
      setSaved((await sepacct.saveOwnIncome(viewer.householdId!, parsed.agorot)).monthlyAgorot);
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      // The parser above sends only `null` or a non-negative integer, so this is the wire refusing
      // something the client thought was fine — say so plainly rather than swallowing it.
      else if (cause instanceof SepacctError && cause.code === "income.invalid") setError("הסכום לא התקבל. אפשר להזין מספר עם עד שתי ספרות אחרי הנקודה.");
      else setError("לא הצלחנו לשמור את ההכנסה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const result = await sepacct.saveOwnIncome(viewer.householdId!, null);
      setSaved(result.monthlyAgorot);
      setValue("");
    } catch (cause) {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו למחוק את ההכנסה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };
  const parsedPrivatePlan = agorotFromInput(privatePlanValue);
  const privatePlanInvalid = !parsedPrivatePlan.ok;
  const savePrivatePlan = async () => {
    if (savingPrivatePlan || !parsedPrivatePlan.ok) return;
    setSavingPrivatePlan(true);
    setError(undefined);
    try {
      const result = await sepacct.saveOwnPrivatePlan(viewer.householdId!, parsedPrivatePlan.agorot);
      setPrivatePlan(result.monthlyAgorot);
      setPrivatePlanValue(inputFromAgorot(result.monthlyAgorot));
    } catch (cause) {
      if (isAbsent(cause)) setPrivatePlanAvailable(false);
      else setError("לא הצלחנו לשמור את התוכנית האישית. נסו שוב.");
    } finally {
      setSavingPrivatePlan(false);
    }
  };
  const clearPrivatePlan = async () => {
    if (savingPrivatePlan) return;
    setSavingPrivatePlan(true);
    setError(undefined);
    try {
      const result = await sepacct.saveOwnPrivatePlan(viewer.householdId!, null);
      setPrivatePlan(result.monthlyAgorot);
      setPrivatePlanValue("");
    } catch (cause) {
      if (isAbsent(cause)) setPrivatePlanAvailable(false);
      else setError("לא הצלחנו למחוק את התוכנית האישית. נסו שוב.");
    } finally {
      setSavingPrivatePlan(false);
    }
  };

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className={`${styles.surface} ${styles.incomeCard}`}>
        <div className={styles.incomeLead}>
          <span className={styles.incomeIcon}><LockKeyhole size={21} aria-hidden /></span>
          <div>
            <h2 className={styles.incomeTitle}>סכום חודשי</h2>
            <p className={styles.incomeCopy}>רק את/ה רואה את הסכום. הוא לא מופיע אצל בן/בת הזוג או מנהלי הבית, לא מצטרף לתקציב המשותף ולא משנה את יחס החלוקה.</p>
          </div>
        </div>
        <div className={styles.incomeField}>
          <label htmlFor="own-income">הכנסה בשקלים</label>
          <input id="own-income" className="input mono" data-action="set-own-income" inputMode="decimal" dir="ltr" value={value} onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ""))} aria-invalid={invalid || undefined} aria-describedby={invalid ? "own-income-error" : undefined} />
        </div>
        {invalid && <p id="own-income-error" className="status error" role="alert">אפשר להזין מספר עם עד שתי ספרות אחרי הנקודה.</p>}
        <div className={styles.incomeFooter}>
          <p className={styles.savedState}>{saved === null ? "עדיין לא נשמר סכום. שדה ריק מוחק את מה שנשמר." : <>נשמר: <strong><bdi className="mono" dir="ltr">{ilsFromAgorot(saved)}</bdi></strong></>}</p>
          <div className="row">
          <button type="button" className="button" data-action="save-own-income" onClick={() => void save()} aria-busy={saving} aria-disabled={invalid || undefined}>{saving ? "שומרים..." : "שמירה"}</button>
          {saved !== null && <button type="button" className="button secondary" data-action="delete-own-income" onClick={() => void clear()} aria-busy={saving}>מחיקת הסכום</button>}
          </div>
        </div>
      </section>
      {privatePlanAvailable && (
        <section className={`${styles.surface} ${styles.incomeCard}`} style={{ marginTop: 16 }}>
          <div className={styles.incomeLead}>
            <span className={styles.incomeIcon}><LockKeyhole size={21} aria-hidden /></span>
            <div>
              <h2 className={styles.incomeTitle}>התוכנית האישית שלי</h2>
              <p className={styles.incomeCopy}>זהו הסכום החודשי שתרצו לנהל עבור עצמכם. אחרי כל הוצאה פרטית או משותפת נציג לכם את ההוצאות הפרטיות שלכם ואת החלק המחושב שלכם בהוצאות הבית מול התוכנית הזאת. רק אתם רואים אותו; הוא אינו משנה את תקציב הבית או את יחס החלוקה.</p>
            </div>
          </div>
          <div className={styles.incomeField}>
            <label htmlFor="own-private-plan">סכום חודשי בשקלים</label>
            <input id="own-private-plan" className="input mono" data-action="set-own-private-plan" inputMode="decimal" dir="ltr" value={privatePlanValue} onChange={(event) => setPrivatePlanValue(event.target.value.replace(/[^\d.]/g, ""))} aria-invalid={privatePlanInvalid || undefined} aria-describedby={privatePlanInvalid ? "own-private-plan-error" : undefined} />
          </div>
          {privatePlanInvalid && <p id="own-private-plan-error" className="status error" role="alert">אפשר להזין מספר עם עד שתי ספרות אחרי הנקודה.</p>}
          <div className={styles.incomeFooter}>
            <p className={styles.savedState}>{privatePlan === null ? "עדיין לא נשמרה תוכנית. שדה ריק מוחק את מה שנשמר." : <>נשמרה תוכנית של: <strong><bdi className="mono" dir="ltr">{ilsFromAgorot(privatePlan)}</bdi></strong></>}</p>
            <div className="row">
              <button type="button" className="button" data-action="save-own-private-plan" onClick={() => void savePrivatePlan()} aria-busy={savingPrivatePlan} aria-disabled={privatePlanInvalid || undefined}>{savingPrivatePlan ? "שומרים..." : "שמירה"}</button>
              {privatePlan !== null && <button type="button" className="button secondary" data-action="delete-own-private-plan" onClick={() => void clearPrivatePlan()} aria-busy={savingPrivatePlan}>מחיקת התוכנית</button>}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
