"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { agorotFromInput, inputFromAgorot, isAbsent, SEPACCT_UI_ENABLED, SepacctError } from "../../lib/sepacct";
import { sepacct } from "../../lib/sepacctApi";
import { useViewer } from "../../lib/useViewer";

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

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h2>סכום חודשי</h2>
        {/* `R-3`: this is the screen with the actual input box, and it gave the WEAKEST of the six
            sibling guarantees in the product - it said "private" and never said from whom. The
            strongest sentence the code supports is stated here, because this is where a person
            decides whether to type the number at all. All three clauses are true: `member_income`
            is read only by its owner (there is no route at any role that serves another member`s),
            and `A61` forbids any ratio computed from it. */}
        <p className="muted">הסכום פרטי: לא רואים אותו בן/בת הזוג ולא מנהלי הבית, הוא לא מצטרף לשום סכום משותף, והוא לא משפיע על יחס החלוקה של ההוצאות.</p>
        <label htmlFor="own-income" style={{ display: "block", fontWeight: 600, marginBottom: "var(--sp-2)" }}>הכנסה בשקלים</label>
        <input id="own-income" className="input mono" data-action="set-own-income" inputMode="decimal" dir="ltr" value={value} onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ""))} aria-invalid={invalid || undefined} aria-describedby={invalid ? "own-income-error" : undefined} />
        {invalid && <p id="own-income-error" className="status error" role="alert">אפשר להזין מספר עם עד שתי ספרות אחרי הנקודה.</p>}
        <p className="muted">{saved === null ? "עדיין לא נשמר סכום. שדה ריק מוחק את מה שנשמר." : <>נשמר: <bdi className="mono" dir="ltr">{ilsFromAgorot(saved)}</bdi></>}</p>
        <div className="row">
          <button type="button" className="button" data-action="save-own-income" onClick={() => void save()} aria-busy={saving} aria-disabled={invalid || undefined}>{saving ? "שומרים..." : "שמירה"}</button>
          {saved !== null && <button type="button" className="button secondary" data-action="delete-own-income" onClick={() => void clear()} aria-busy={saving}>מחיקת הסכום</button>}
        </div>
      </section>
    </AppShell>
  );
}
