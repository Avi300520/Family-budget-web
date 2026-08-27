"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { agorotFromInput, inputFromAgorot, isAbsent, SEPACCT_UI_ENABLED } from "../../lib/sepacct";
import { MOCK_HOUSEHOLD_ID, previewState, sepacctMock } from "../../lib/sepacctMock";

const TITLE = "ההכנסה שלי";

export default function MyIncomePage() {
  if (!SEPACCT_UI_ENABLED) notFound();

  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [absent, setAbsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "dormant") { setAbsent(true); return; }
    if (preview === "error") { setError("לא הצלחנו לטעון את ההכנסה. נסו שוב."); return; }
    void sepacctMock.getOwnIncome(MOCK_HOUSEHOLD_ID).then((data) => {
      // §3 — `monthlyAgorot` is explicitly null when unset, and null for a child. Never absent.
      const next = preview === "empty" ? null : data.monthlyAgorot;
      setSaved(next);
      setValue(inputFromAgorot(next));
      setLoaded(true);
    }).catch((cause) => {
      if (isAbsent(cause)) setAbsent(true);
      else setError("לא הצלחנו לטעון את ההכנסה. נסו שוב.");
    });
  }, [preview]);

  if (absent) notFound();
  if (error) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState error={error} /></AppShell>;
  if (!loaded) return <AppShell><h1 className="page-title">{TITLE}</h1><LoadState /></AppShell>;

  const parsed = agorotFromInput(value);
  const invalid = !parsed.ok;
  const save = async () => {
    if (saving || !parsed.ok) return;
    setSaving(true);
    // An empty field is `null` — the wire's "clear it" — not an omitted field (§3).
    try { setSaved((await sepacctMock.saveOwnIncome(MOCK_HOUSEHOLD_ID, parsed.agorot)).monthlyAgorot); }
    catch (cause) { if (isAbsent(cause)) setAbsent(true); else setError("לא הצלחנו לשמור את ההכנסה. נסו שוב."); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <h1 className="page-title">{TITLE}</h1>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h2>סכום חודשי</h2>
        <p className="muted">הסכום פרטי. הוא לא משותף ולא מצטרף לסכום אחר.</p>
        <label htmlFor="own-income" style={{ display: "block", fontWeight: 600, marginBottom: "var(--sp-2)" }}>הכנסה בשקלים</label>
        <input id="own-income" className="input mono" inputMode="decimal" dir="ltr" value={value} onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ""))} aria-invalid={invalid || undefined} aria-describedby={invalid ? "own-income-error" : undefined} />
        {invalid && <p id="own-income-error" className="status error" role="alert">אפשר להזין מספר עם עד שתי ספרות אחרי הנקודה.</p>}
        <p className="muted">{saved === null ? "עדיין לא נשמר סכום. שדה ריק מוחק את מה שנשמר." : <>נשמר: <bdi className="mono" dir="ltr">{ilsFromAgorot(saved)}</bdi></>}</p>
        <button type="button" className="button" onClick={() => void save()} aria-busy={saving} aria-disabled={invalid || undefined}>{saving ? "שומרים..." : "שמירה"}</button>
      </section>
    </AppShell>
  );
}
