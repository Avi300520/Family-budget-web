"use client";

// Public home / login landing for קופה משפחתית (Pingtally).
// Marketing story + pricing + the phone-capture form that sends a real
// WhatsApp magic-link (preserving the ?next= the auth guard relies on).
// Ported from the Cloud Design handoff (design_handoff_home_page). Tokens and
// primitives (.btn/.card/.mono/.h3) already live in tokens.css/primitives.css.

import Link from "next/link";
import {
  Camera, Check, Home, MessageCircle, Send, ShoppingCart,
  Sparkles, Target, Users, Wallet,
} from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { PhoneInput } from "../../components/PhoneInput";
import { DEFAULT_COUNTRY_ISO, dialForIso, toE164 } from "../../lib/countryCodes";

const WA_GREEN = "#25D366";

/* ── Trial badge ─────────────────────────────────────────────────────────── */
function TrialBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 22,
      padding: "7px 14px", borderRadius: 999,
      background: "var(--mustard-bg)", border: "1px solid var(--mustard-soft)",
      color: "var(--warn)", fontSize: 13, fontWeight: 600,
    }}>
      <Sparkles size={15} /> 20 יום חינם, בלי כרטיס אשראי
    </span>
  );
}

/* ── Phone capture (the conversion action — real magic-link) ─────────────── */
function LoginForm() {
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return; // sync re-entrancy guard: never fire two magic-link sends
    setError(undefined);
    // Read ?next= lazily at submit (client-only event) instead of useSearchParams,
    // so the whole landing prerenders to static HTML instead of bailing to CSR.
    const next = new URLSearchParams(window.location.search).get("next") ?? undefined;
    const e164 = toE164(dialForIso(countryIso), phone);
    if (!e164) {
      setError("מספר הטלפון לא נראה תקין.");
      return;
    }
    inFlight.current = true;
    setWorking(true);
    try {
      await api.requestMagicLink(e164, next);
      setSentTo(e164);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת קישור");
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }

  if (sentTo) {
    return (
      <div className="home-form-card" style={{ background: "var(--teal-bg)", borderColor: "var(--teal-soft)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: WA_GREEN, display: "grid", placeItems: "center", color: "#FFF", flexShrink: 0 }}>
            <MessageCircle size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>שלחנו לכם קישור כניסה בוואטסאפ</div>
            <div style={{ fontSize: 13, color: "var(--text-1)", marginTop: 4, lineHeight: 1.5 }}>
              לחיצה על הקישור תפתח את הדשבורד. הקישור תקף ל-10 דקות, בלי סיסמה ובלי הורדה.
            </div>
            <div style={{ fontSize: 13, marginTop: 8 }} className="mono" dir="ltr">{sentTo}</div>
            <button onClick={() => setSentTo(undefined)} className="btn ghost sm" style={{ marginTop: 12, padding: "0 10px" }}>שליחה שוב</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="home-form-card" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <label htmlFor="home-phone" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600, display: "block", marginBottom: 8 }}>
        מספר הטלפון שלכם
      </label>
      <PhoneInput
        id="home-phone"
        countryIso={countryIso}
        onCountryChange={(iso) => { setCountryIso(iso); setError(undefined); }}
        phone={phone}
        onPhoneChange={(v) => { setPhone(v); setError(undefined); }}
        phoneAriaLabel="מספר הטלפון שלכם"
        disabled={working}
        invalid={Boolean(error)}
      />
      {error && <div role="alert" style={{ color: "var(--neg)", fontSize: 13, marginTop: 10 }}>{error}</div>}
      <button type="submit" disabled={working} className="btn primary" style={{ width: "100%", height: 50, fontSize: 15, marginTop: 12, borderRadius: "var(--r-3)" }}>
        <Send size={17} /> {working ? "שולח…" : "שלחו לי קישור כניסה"}
      </button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MessageCircle size={13} color={WA_GREEN} /> כניסה בוואטסאפ</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={13} /> בלי סיסמאות</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={13} /> בלי הורדה</span>
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--cream-3)", fontSize: 12.5, color: "var(--text-1)", textAlign: "center", lineHeight: 1.5 }}>
        חינם ל-20 יום, בלי כרטיס אשראי. אחר כך החל מ-<strong>₪19.90/חודש</strong> לכל המשפחה.
        {" "}<a href="#pricing" style={{ color: "var(--teal-dark)", fontWeight: 600 }}>לכל המסלולים</a>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
        בכניסה אתם מסכימים <Link href="/terms" style={{ color: "var(--teal-dark)" }}>לתנאי השימוש</Link>{" "}
        ול<Link href="/privacy" style={{ color: "var(--teal-dark)" }}>מדיניות הפרטיות</Link> שלנו.
      </p>
    </form>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */
function HomeNav() {
  return (
    <header className="home-nav">
      <div className="home-wrap home-nav-inner">
        <a href="#top" className="home-brand">
          <span className="home-logo">ק</span>
          <span>
            <span className="home-brand-name">קופה משפחתית</span>
            <span className="home-brand-sub">Pingtally</span>
          </span>
        </a>
        <nav className="home-nav-links">
          <a href="#features">מה מקבלים</a>
          <a href="#how">איך זה עובד</a>
          <a href="#pricing">מחיר</a>
        </nav>
        <a href="#top" className="btn primary sm home-nav-cta">התחלה חינם</a>
      </div>
    </header>
  );
}

/* ── Hero visual: message in → dashboard out ─────────────────────────────── */
function HeroDashboardCard() {
  const cats = [
    { icon: "🛒", name: "סופר ומזון", spent: 4280, budget: 5000, color: "var(--teal)" },
    { icon: "🍕", name: "אוכל בחוץ", spent: 1180, budget: 900, color: "var(--coral)", over: true },
    { icon: "🎨", name: "ילדים וחוגים", spent: 1840, budget: 2000, color: "var(--mustard)" },
  ];
  return (
    <div style={{ width: "100%", background: "var(--cream-2)", borderRadius: "var(--r-5)", border: "1px solid var(--cream-3)", boxShadow: "var(--elev-3)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--cream-3)", background: "var(--cream-1)" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg, var(--coral) 0%, var(--mustard) 100%)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#FFF" }}>ק</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>קופה משפחתית</div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>· משפחת לוי</div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>
          {["var(--m-mom)", "var(--m-dad)", "var(--m-teen)"].map((c, i) => (
            <span key={i} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: "2px solid var(--cream-2)", marginInlineStart: i ? -8 : 0 }} />
          ))}
        </div>
      </div>
      <div style={{ padding: 18, display: "grid", gap: 16 }}>
        <div style={{ borderRadius: "var(--r-4)", padding: 18, color: "#FFF", background: "linear-gradient(135deg, #134E48 0%, #0F766E 60%, #2A8C7B 100%)", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>הוצאתם החודש · מאי</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>₪16,420</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>מתוך ₪18,500</span>
          </div>
          <div style={{ height: 7, background: "rgba(255,255,255,0.2)", borderRadius: 999, marginTop: 12, overflow: "hidden", position: "relative" }}>
            <div style={{ width: "88%", height: "100%", background: "#FFF", borderRadius: 999 }} />
            <div style={{ position: "absolute", insetInlineStart: "80%", top: -2, bottom: -2, width: 2, background: "rgba(255,255,255,0.75)" }} />
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.18)", fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#A7E8C0" }} /> בקצב טוב · נשארו ₪2,080
          </span>
        </div>
        <div style={{ display: "grid", gap: 11 }}>
          {cats.map((c, i) => {
            const pct = Math.min(100, (c.spent / c.budget) * 100);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 10, alignItems: "center" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14, background: `color-mix(in oklab, ${c.color} 12%, var(--cream-2))`, display: "grid", placeItems: "center" }}>{c.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span className="mono" style={{ color: c.over ? "var(--neg)" : "var(--text-2)" }}>
                      ₪{c.spent.toLocaleString("he-IL")}<span style={{ color: "var(--text-3)" }}> / {c.budget.toLocaleString("he-IL")}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--cream-3)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: c.over ? "var(--neg)" : c.color, borderRadius: 999 }} />
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: c.over ? "var(--neg)" : "var(--text-2)", minWidth: 30, textAlign: "end" }}>
                  {Math.round((c.spent / c.budget) * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniBubble({ sent = false, children }: { sent?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: sent ? "flex-start" : "flex-end", marginBottom: 5 }}>
      <div style={{
        maxWidth: "86%", background: sent ? "#DCF8C6" : "#FFFFFF", borderRadius: 9,
        borderTopRightRadius: sent ? 9 : 2, borderTopLeftRadius: sent ? 2 : 9,
        padding: "7px 10px", fontSize: 12.5, lineHeight: 1.4, color: "#1D1F1E",
        boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
      }}>{children}</div>
    </div>
  );
}

function HeroPhoneCard() {
  const groups = [
    { emoji: "🥦", name: "פירות וירקות", items: ["אבוקדו"] },
    { emoji: "🥛", name: "מוצרי חלב וקירור", items: ["חלב x2"] },
    { emoji: "🌽", name: "מזווה / יבשים", items: ["אורז פרסי"] },
    { emoji: "👶", name: "תינוקות וילדים", items: ["שמפו לילדים"] },
    { emoji: "🧴", name: "טואלטיקה והיגיינה", items: ["תחליב רחצה"] },
  ];
  return (
    <div style={{ width: 264, borderRadius: 30, background: "#0F1411", padding: 7, boxShadow: "var(--elev-3), 0 24px 48px rgba(15,42,40,0.28)" }}>
      <div style={{ borderRadius: 24, overflow: "hidden", background: "#E5DDD5", position: "relative" }}>
        <div style={{ position: "absolute", top: 8, insetInlineStart: "50%", transform: "translateX(-50%)", width: 84, height: 20, background: "#0F1411", borderRadius: 999, zIndex: 2 }} />
        <div style={{ background: "#F6F6F6", padding: "26px 12px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: "linear-gradient(135deg, var(--coral) 0%, var(--mustard) 100%)", display: "grid", placeItems: "center", color: "#FFF", fontWeight: 800, fontSize: 14 }}>פ</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#000" }}>פינג</div>
            <div style={{ fontSize: 10.5, color: WA_GREEN }}>מקליד…</div>
          </div>
        </div>
        <div style={{ padding: "11px 9px 13px", backgroundImage: "radial-gradient(circle at 10% 20%, rgba(255,255,255,0.4) 1px, transparent 1px), radial-gradient(circle at 80% 50%, rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px, 70px 70px" }}>
          <MiniBubble sent>קפה בארומה 18</MiniBubble>
          <MiniBubble>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, minWidth: 178 }}>
              <div>✅ נרשם: <strong>18 ש&quot;ח בארומה</strong> (מסעדות וקפה).</div>
              <div style={{ marginTop: 3 }}>💰 נשארו <strong>6,628 ש&quot;ח</strong> לתקציב החודשי.</div>
              <div style={{ marginTop: 4, color: "#667781" }}>אפשר גם לשלוח קבלה, ואשמור אותה עם ההוצאה.</div>
            </div>
          </MiniBubble>
          <MiniBubble sent>2 חלב, אורז פרסי, שמפו לילדים, תחליב רחצה, אבוקדו</MiniBubble>
          <MiniBubble>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, minWidth: 188 }}>
              <div style={{ fontWeight: 700, marginBottom: 7 }}>🛒 הוספתי 5 פריטים:</div>
              {groups.map((c, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0B5C56" }}>{c.emoji} {c.name}:</div>
                  {c.items.map((it, j) => (<div key={j} style={{ color: "#1D1F1E" }}>• {it}</div>))}
                </div>
              ))}
            </div>
          </MiniBubble>
        </div>
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div style={{ width: "100%", paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 240, maxWidth: 340, position: "relative" }}>
          <div style={{ position: "absolute", top: -13, insetInlineEnd: 14, zIndex: 3, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, background: "var(--ink-0)", color: "var(--on-ink-0)", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 999, boxShadow: "var(--elev-2)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: WA_GREEN }} />
            מה שכתבתם, מסודר כאן
          </div>
          <div style={{ paddingTop: 16 }}><HeroDashboardCard /></div>
        </div>
        <div className="home-phone-tilt" style={{ flexShrink: 0 }}><HeroPhoneCard /></div>
      </div>
    </div>
  );
}

/* ── Features ────────────────────────────────────────────────────────────── */
function FeaturesSection() {
  const feats = [
    { icon: <Wallet size={22} />, color: "var(--teal-dark)", bg: "var(--teal-bg)", title: "הוצאות בהודעה אחת", body: "כותבים \"קפה 18\" והבוט ממיין לקטגוריה ומעדכן את התקציב לבד." },
    { icon: <Camera size={22} />, color: "var(--plum)", bg: "var(--plum-bg)", title: "קבלות בצילום", body: "מצלמים קבלה מהסופר וזה מתפצל אוטומטית בין מזון, בית וכל קטגוריה, בלי להקליד כלום." },
    { icon: <ShoppingCart size={22} />, color: "var(--warn)", bg: "var(--mustard-bg)", title: "רשימת קניות חכמה", body: "כל המשפחה מוסיפה פריטים לרשימת הקניות, כשהולכים לסופר מבקשים את הרשימה ומקבלים אותה מסודרת לפי הקטגוריות בסופר." },
    { icon: <Target size={22} />, color: "var(--coral-dark)", bg: "var(--coral-bg)", title: "פרויקטים וחיסכון", body: "חופשה, בר מצווה, שיפוץ. אפשר ליצור תקציבים שונים לפי פרויקט." },
    { icon: <Users size={22} />, color: "var(--ocean)", bg: "var(--ocean-bg)", title: "ילדים ודמי כיס", body: "קצבה חודשית, פרויקטים אישיים, בקשות אישור והרשאות לכל ילד, כדי שהילד ילמד להתנהל נכון עם הכסף שלו." },
    { icon: <Sparkles size={22} />, color: "var(--berry)", bg: "var(--berry-bg)", title: "סיכום שבועי חכם", body: "פעם בשבוע מקבלים תמונה קצרה לוואטסאפ: איפה אנחנו ביעד לתקציב, באיזה קטגוריות הוצאנו כסף ועוד תובנות חכמות שיעזרו להיות בשליטה ולהבין יותר על מה אנחנו מוציאים את הכסף." },
  ];
  return (
    <section id="features" className="home-section">
      <div className="home-wrap">
        <div className="home-section-head">
          <div className="home-eyebrow">מה מקבלים</div>
          <h2 className="home-h2">כלי ניהול אמיתי שחי בתוך וואטסאפ</h2>
          <p className="home-lead">בלי להוריד אפליקציה ובלי טבלאות אקסל. כותבים הודעה, והכל מצטבר לדשבורד אחד שכל המשפחה רואה.</p>
        </div>
        <div className="home-features-grid">
          {feats.map((f, i) => (
            <div key={i} className="card home-feature">
              <span className="home-feature-icon" style={{ background: f.bg, color: f.color }}>{f.icon}</span>
              <h3 className="h3" style={{ marginTop: 14, fontSize: 16 }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.55, margin: "6px 0 0" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────────── */
function HowSection() {
  const steps = [
    { n: "1", icon: <MessageCircle size={20} color={WA_GREEN} />, title: "שולחים הודעה", body: "הוצאה, קבלה או פריט לרשימה, בכתב או בצילום. בקבוצת המשפחה או בצ'אט עם הבוט." },
    { n: "2", icon: <Sparkles size={20} />, title: "הבוט מסדר", body: "מזהה את הסכום, הקטגוריה ומי שלח, ומשייך לתקציב הנכון אוטומטית." },
    { n: "3", icon: <Home size={20} />, title: "תובנות בוואטסאפ", body: "את כל התובנות מקבלים ישירות בוואטסאפ. לדשבורד נכנסים רק כשרוצים תמונה מלאה ועמוקה יותר: החודש, הקטגוריות, הפרויקטים והפעילות של כולם." },
  ];
  return (
    <section id="how" className="home-section home-section-alt">
      <div className="home-wrap">
        <div className="home-section-head">
          <div className="home-eyebrow">איך זה עובד</div>
          <h2 className="home-h2">שלושה צעדים, אפס למידה</h2>
        </div>
        <div className="home-steps">
          {steps.map((s, i) => (
            <div key={i} className="home-step">
              <div className="home-step-top">
                <span className="home-step-num">{s.n}</span>
                <span className="home-step-icon">{s.icon}</span>
              </div>
              <h3 className="h3" style={{ fontSize: 16, marginTop: 16 }}>{s.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.55, margin: "6px 0 0" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */
function PriceBullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.45 }}>
      <span style={{ color: "var(--teal)", marginTop: 1, flexShrink: 0 }}><Check size={16} /></span>
      <span>{children}</span>
    </li>
  );
}

function PricingSection() {
  const [yr, setYr] = useState(false);
  const tiers = [
    { name: "זוגי", who: "זוג, בלי ילדים", mo: "19.90", yr: "199", limit: "עד 40 צילומי קבלות בחודש" },
    { name: "משפחה", who: "זוג + עד 2 ילדים", mo: "29.90", yr: "299", limit: "עד 70 צילומי קבלות בחודש", featured: true },
    { name: "מורחב", who: "זוג + 3 ילדים ומעלה", mo: "39.90", yr: "399", limit: "צילומי קבלות ללא הגבלה" },
  ];
  return (
    <section id="pricing" className="home-section">
      <div className="home-wrap">
        <div className="home-section-head">
          <div className="home-eyebrow">מחיר</div>
          <h2 className="home-h2">מתחילים חינם. ממשיכים בזול.</h2>
          <p className="home-lead">20 יום ניסיון מלא, עם כל הפיצ'רים פתוחים. אחר כך בוחרים מסלול לפי גודל המשפחה. מחיר אחד לכל הבית, לא לכל משתמש.</p>
        </div>

        <div className="home-trial-banner">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="home-trial-icon"><Sparkles size={24} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>20 יום חינם, בלי כרטיס אשראי</div>
              <div style={{ fontSize: 13.5, color: "var(--text-1)", marginTop: 3 }}>כל המסלולים פתוחים במלואם, כולל צילומי קבלות ללא הגבלה. בלי התחייבות.</div>
            </div>
          </div>
          <a href="#top" className="btn primary" style={{ height: 46, padding: "0 22px", whiteSpace: "nowrap" }}>מתחילים חינם</a>
        </div>

        <div className="home-toggle-wrap">
          <div className="home-billing-toggle">
            <button type="button" className={!yr ? "active" : ""} onClick={() => setYr(false)}>חודשי</button>
            <button type="button" className={yr ? "active" : ""} onClick={() => setYr(true)}>שנתי · חיסכון ~17%</button>
          </div>
        </div>

        <div className="home-pricing-grid">
          {tiers.map((t, i) => (
            <div key={i} className={`card home-price-card${t.featured ? " home-price-featured" : ""}`}>
              {t.featured && <div className="home-price-flag"><span>הכי פופולרי</span></div>}
              <div className="home-price-name">{t.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>{t.who}</div>
              <div className="home-price-amt">
                <span style={{ fontSize: 22, color: "var(--text-2)" }}>₪</span>
                <span className="mono" style={{ fontSize: 46 }}>{yr ? t.yr : t.mo}</span>
                <span style={{ fontSize: 15, color: "var(--text-2)" }}>/ {yr ? "שנה" : "חודש"}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 18, minHeight: 18 }}>
                {yr ? `בערך ₪${(+t.yr / 12).toFixed(1)} לחודש` : "חיוב חודשי, בלי התחייבות"}
              </div>
              <ul className="home-price-bullets">
                <PriceBullet>כל הפיצ'רים, כל המשפחה</PriceBullet>
                <PriceBullet>{t.limit}</PriceBullet>
                <PriceBullet>ביטול בכל רגע</PriceBullet>
              </ul>
              <a href="#top" className={`btn${t.featured ? " primary" : ""}`} style={{ width: "100%", height: 46, marginTop: 20 }}>
                {t.featured ? "בוחרים את זה" : "בחירת מסלול"}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-2)", marginTop: 22 }}>
          כל המחירים כוללים מע״מ. בתקופת הניסיון הכל פתוח וללא הגבלת קבלות. נזכיר לכם לפני כל חיוב, בלי הפתעות.
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="home-final">
      <div className="home-wrap home-final-inner">
        <div>
          <h2 className="home-h2" style={{ color: "#FFF" }}>נסו 20 יום. בלי כרטיס אשראי.</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, margin: "8px 0 0" }}>קישור כניסה אחד בוואטסאפ וכל המשפחה בפנים.</p>
        </div>
        <a href="#top" className="btn" style={{ height: 50, padding: "0 28px", fontSize: 15, background: "#FFF", borderColor: "#FFF", color: "var(--teal-dark)", fontWeight: 700 }}>
          <Send size={17} /> מתחילים עכשיו
        </a>
      </div>
    </section>
  );
}

function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="home-wrap home-footer-inner">
        <div className="home-brand">
          <span className="home-logo">ק</span>
          <span>
            <span className="home-brand-name">קופה משפחתית</span>
            <span className="home-brand-sub">Pingtally</span>
          </span>
        </div>
        <div className="home-footer-links">
          <Link href="/terms">תנאי שימוש</Link>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <a href="#top">כניסה לחשבון</a>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>© 2026 קופה משפחתית</div>
      </div>
    </footer>
  );
}

function HomeContent() {
  return (
    <div id="top" className="home-root">
      <HomeNav />
      <section className="home-hero">
        <div className="home-wrap home-hero-grid">
          <div className="home-hero-text">
            <TrialBadge />
            <h1 className="home-h1">כל הכסף של המשפחה,<br />מנוהל מתוך וואטסאפ.</h1>
            <p className="home-hero-lead">
              רושמים הוצאה בהודעה, מצלמים קבלה, מנהלים רשימת קניות ופרויקטים, והכל מסתדר לבד בדשבורד אחד לכל המשפחה.
            </p>
            <LoginForm />
          </div>
          <div className="home-hero-visual"><HeroPreview /></div>
        </div>
      </section>

      <div className="home-trust">
        <div className="home-wrap home-trust-inner">
          <span className="home-trust-item"><MessageCircle size={15} color={WA_GREEN} /> בלי להוריד אפליקציה</span>
          <span className="home-trust-item"><Check size={15} /> מאובטח ומוצפן</span>
          <span className="home-trust-item"><Users size={15} /> כל המשפחה בחשבון אחד</span>
          <span className="home-trust-item"><Check size={15} /> ביטול בכל רגע</span>
        </div>
      </div>

      <FeaturesSection />
      <HowSection />
      <PricingSection />
      <FinalCTA />
      <HomeFooter />
    </div>
  );
}

export default function LoginPage() {
  return <HomeContent />;
}
