"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { ilsFromAgorot } from "../../lib/format";
import { previewState, sepacctMock } from "../../lib/sepacctMock";

function parseAgorot(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(trimmed);
  if (!match) return undefined;
  const whole = Number(match[1]);
  if (!Number.isSafeInteger(whole)) return undefined;
  return whole * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export default function MyIncomePage() {
  const [agorot, setAgorot] = useState<number>();
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const preview = typeof window === "undefined" ? "populated" : previewState(new URLSearchParams(window.location.search).get("state"));

  useEffect(() => {
    if (preview === "loading") return;
    if (preview === "error") { setError("לא הצלחנו לטעון את ההכנסה. נסו שוב."); return; }
    void sepacctMock.getOwnIncome().then((data) => {
      const next = preview === "empty" ? undefined : data.monthlyAgorot;
      setAgorot(next);
      setValue(next === undefined ? "" : `${Math.trunc(next / 100)}.${String(next % 100).padStart(2, "0")}`);
      setLoaded(true);
    }).catch(() => setError("לא הצלחנו לטעון את ההכנסה. נסו שוב."));
  }, [preview]);

  if (error) return <AppShell><h1 className="page-title">ההכנסה שלי</h1><LoadState error={error} /></AppShell>;
  if (!loaded) return <AppShell><h1 className="page-title">ההכנסה שלי</h1><LoadState /></AppShell>;
  const parsed = parseAgorot(value);
  const invalid = value.trim() !== "" && parsed === undefined;
  const save = async () => {
    if (saving || invalid) return;
    setSaving(true);
    try { const data = await sepacctMock.saveOwnIncome(parsed); setAgorot(data.monthlyAgorot); }
    catch { setError("לא הצלחנו לשמור את ההכנסה. נסו שוב."); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <h1 className="page-title">ההכנסה שלי</h1>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h2>סכום חודשי</h2>
        <p className="muted">הסכום פרטי. הוא לא משותף ולא מצטרף לסכום אחר.</p>
        <label htmlFor="own-income" style={{ display: "block", fontWeight: 600, marginBottom: "var(--sp-2)" }}>הכנסה בשקלים</label>
        <input id="own-income" className="input mono" inputMode="decimal" dir="ltr" value={value} onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ""))} aria-invalid={invalid || undefined} aria-describedby={invalid ? "own-income-error" : undefined} />
        {invalid && <p id="own-income-error" className="status error" role="alert">אפשר להזין מספר עם עד שתי ספרות אחרי הנקודה.</p>}
        {agorot !== undefined && <p className="muted">נשמר: <bdi className="mono" dir="ltr">{ilsFromAgorot(agorot)}</bdi></p>}
        <button type="button" className="button" onClick={() => void save()} aria-busy={saving} aria-disabled={invalid || undefined}>{saving ? "שומרים..." : "שמירה"}</button>
      </section>
    </AppShell>
  );
}
