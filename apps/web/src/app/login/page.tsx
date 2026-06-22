"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { Suspense, useState } from "react";
import { api } from "../../lib/api";
import { PhoneInput } from "../../components/PhoneInput";
import { DEFAULT_COUNTRY_ISO, dialForIso, toE164 } from "../../lib/countryCodes";

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;

  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    const e164 = toE164(dialForIso(countryIso), phone);
    if (!e164) {
      setError("מספר הטלפון לא נראה תקין.");
      return;
    }
    setWorking(true);
    try {
      await api.requestMagicLink(e164, next);
      setSentTo(e164);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת קישור");
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setSentTo(undefined);
    setError(undefined);
  }

  return (
    <div className="auth-stage">
      {/* ───────────── Hero (brand / product story) ───────────── */}
      <section className="auth-hero">
        <div className="auth-hero__rings" aria-hidden />
        <div className="auth-hero__glow" aria-hidden />

        <div className="auth-brand">
          <div className="auth-brand__mark">P</div>
          <div>
            <div className="auth-brand__name">קופה משפחתית</div>
            <div className="auth-brand__sub">Pingtally</div>
          </div>
        </div>

        {/* live WhatsApp demo (decorative) */}
        <div className="auth-demo" aria-hidden>
          <div className="auth-demo__hd">
            <div className="auth-demo__ava">P</div>
            <div>
              <div className="auth-demo__nm">Pingtally</div>
              <div className="auth-demo__st">● מחובר</div>
            </div>
          </div>
          <div className="auth-bub out">קניתי בשופרסל ב-87 שח<span>9:41 ✓✓</span></div>
          <div className="auth-bub in">רשמתי ✓ <b>87 ש״ח</b> בשופרסל · מצרכים<span>9:41</span></div>
          <div className="auth-bub out">איתי ביקש 30 ש״ח לפיצה 🍕<span>9:42 ✓✓</span></div>
          <div className="auth-bub in">שלחתי לאישורך — <b>כן / לא</b> ✓<span>9:42</span></div>
        </div>

        <div className="auth-hero__mid">
          <span className="auth-eyebrow"><span className="auth-eyebrow__dot" />הכול קורה בוואטסאפ שכבר פתוח אצלכם</span>
          <h1 className="auth-slogan">פחות ניהול.<br /><span className="auth-slogan__accent">יותר משפחה.</span></h1>
          <p className="auth-lede">הוצאות, קניות, פרויקטים והילדים — הכול מתנהל בוואטסאפ. בלי אפליקציה חדשה, בלי סיסמאות.</p>

          <div className="auth-chips">
            <span>הוצאות וקבלות</span>
            <span>רשימות קניות</span>
            <span>פרויקטים</span>
            <span>כל המשפחה</span>
          </div>
        </div>

        <div className="auth-trust">
          <div className="auth-trust__t"><ShieldCheck size={16} aria-hidden />מאובטח מקצה לקצה</div>
          <div className="auth-trust__t"><Check size={16} aria-hidden />בלי סיסמאות</div>
          <div className="auth-trust__t"><MessageCircle size={16} aria-hidden />הכול בוואטסאפ</div>
        </div>
      </section>

      {/* ───────────── Form panel ───────────── */}
      <section className="auth-panel">
        <div className="auth-form">
          {!sentTo ? (
            <form onSubmit={submit} noValidate>
              <span className="auth-badge"><MessageCircle size={15} aria-hidden />כניסה דרך וואטסאפ</span>
              <h2 className="auth-title">נכנסים בלחיצה.</h2>
              <p className="auth-sub">נשלח לך קישור כניסה מאובטח לוואטסאפ. בלי סיסמאות, בלי הורדות — לוחצים ונכנסים.</p>

              <label className="auth-field-label" htmlFor="login-phone">מספר הטלפון שלך</label>
              <PhoneInput
                id="login-phone"
                countryIso={countryIso}
                onCountryChange={(iso) => { setCountryIso(iso); setError(undefined); }}
                phone={phone}
                onPhoneChange={(v) => { setPhone(v); setError(undefined); }}
                disabled={working}
                invalid={Boolean(error)}
              />

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button className="auth-submit" type="submit" disabled={working}>
                <Send size={18} aria-hidden />
                {working ? "שולח…" : "שלחו לי קישור כניסה"}
              </button>

              <p className="auth-legal">
                בכניסה אתם מסכימים{" "}
                <Link href="/terms">לתנאי השימוש</Link>{" "}
                ול<Link href="/privacy">מדיניות הפרטיות</Link> שלנו.
              </p>
            </form>
          ) : (
            <div className="auth-success" role="status">
              <div className="auth-success__ic"><Check size={28} aria-hidden /></div>
              <h2 className="auth-title">הקישור בדרך אליך 📩</h2>
              <p className="auth-sub">פתחו את וואטסאפ והיכנסו בלחיצה אחת. הקישור תקף ל-10 דקות.</p>
              <div className="auth-success__card">
                <div className="auth-success__card-lbl">שלחנו הודעה אל</div>
                <div className="auth-success__num" dir="ltr">{sentTo}</div>
              </div>
              <button className="auth-resend" type="button" onClick={reset}>← לא קיבלתם? שלחו שוב או שנו מספר</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page"><div className="login-box">טוען…</div></div>}>
      <LoginInner />
    </Suspense>
  );
}
