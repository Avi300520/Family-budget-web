// Pingtally public marketing landing - server component (full SSR HTML, fully
// crawlable). Interactive bits are small client islands (nav, magic-link form,
// pricing toggle, FAQ accordion). Rendered at BOTH "/" and "/login".
//
// Copy here is the safety-corrected canonical copy (docs/marketing/CLAIMS_ALLOWLIST.md):
// no billing-reminder promise, credit-card scoped to start, "automatic" only for
// categorization, 15-min magic link, encryption scoped to in-transit, trust BEFORE
// pricing. Hyphens only (no em-dashes - enforced by noEmDash.test.ts).

import "../../styles/marketing.css";
import Link from "next/link";
import {
  Activity, Camera, Check, CreditCard, Eye, Folder, Home, KeyRound, Landmark,
  Lock, MessageCircle, Send, ShieldCheck, ShoppingCart, Sparkles, Tag, Target,
  TrendingDown, TrendingUp, User, Users, Wallet,
} from "lucide-react";
import { MagicLinkForm } from "./MagicLinkForm";
import { LandingNav } from "./LandingNav";
import { LandingFaq } from "./LandingFaq";
import { PricingPlans } from "./PricingPlans";
import { HeroVisual } from "./HeroVisual";
import { PingtallyMark, PingtallyLockup } from "./PingtallyMark";
import { LandingJsonLd } from "./LandingJsonLd";

const WA = "var(--wa)";

/* ── Hero ─────────────────────────────────────────────────────────────────── */
const HERO_CHIPS = [
  { icon: <MessageCircle size={15} color={WA} />, label: "כניסה בוואטסאפ, בלי סיסמה" },
  { icon: <ShieldCheck size={15} />, label: "כניסה מאובטחת וחיבור מוצפן" },
  { icon: <Tag size={15} />, label: "המידע לא נמכר לאף אחד" },
  { icon: <CreditCard size={15} />, label: "בלי כרטיס אשראי כדי להתחיל" },
  { icon: <Landmark size={15} />, label: "בלי לחבר חשבון בנק" },
];

function Hero() {
  return (
    <section id="top" className="pt-hero">
      <div className="pt-hero__bg" aria-hidden="true" />
      <div className="pt-wrap pt-hero__grid">
        <div className="pt-hero__text">
          <span className="pt-hero__badge">
            <Sparkles size={15} /> 20 יום חינם · בלי אשראי להתחלה
          </span>
          <h1>
            לדעת לאן הכסף הולך,
            <br />
            <span className="accent">בלי לפתוח עוד אפליקציה.</span>
          </h1>
          <p className="pt-hero__lead">
            רושמים הוצאה בהודעה, מצלמים קבלה, מנהלים רשימת קניות ותקציבים - ופינג מסדר את הכל
            במקום אחד ברור, מתוך וואטסאפ.
          </p>
          <div id="start" data-anchor>
            <MagicLinkForm variant="hero" idPrefix="pt" />
          </div>
          <div className="pt-hero__chips">
            {HERO_CHIPS.map((c) => (
              <span className="pt-chip" key={c.label}>
                {c.icon} {c.label}
              </span>
            ))}
          </div>
        </div>
        <div className="pt-hero__visual">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

/* ── Outcomes ─────────────────────────────────────────────────────────────── */
const OUTCOMES = [
  { icon: <Wallet size={24} />, color: "var(--teal-dark)", bg: "var(--teal-bg)", title: "רואים לאן הכסף הולך", body: "כל הוצאה נכנסת לקטגוריה הנכונה ומצטברת לתמונה אחת ברורה של החודש - בלי לנחש ובלי טבלאות." },
  { icon: <Camera size={24} />, color: "var(--plum)", bg: "var(--plum-bg)", title: "סוף לבלאגן בקבלות", body: "מצלמים קבלה ושולחים, ה-AI עוזר לקרוא ולסווג ואתם מאשרים בקצרה. הקבלה נשמרת יחד עם ההוצאה." },
  { icon: <ShoppingCart size={24} />, color: "var(--mustard-dark)", bg: "var(--mustard-bg)", title: "רשימת קניות אחת, מסודרת", body: "כל בני הבית מוסיפים פריטים, וכשהולכים לסופר מקבלים רשימה מסודרת לפי קטגוריות." },
  { icon: <TrendingUp size={24} />, color: "var(--coral-dark)", bg: "var(--coral-bg)", title: "לתפוס חריגות בזמן", body: "פינג עוזר לראות חריגות לפני סוף החודש, כשעוד אפשר להגיב." },
  { icon: <Target size={24} />, color: "var(--ocean)", bg: "var(--ocean-bg)", title: "תקציבים צדדיים, בנפרד", body: "חופשה, שיפוץ או בר מצווה - אפשר לנהל תקציב נפרד לכל פרויקט, בלי לערבב עם השוטף." },
  { icon: <Users size={24} />, color: "var(--berry)", bg: "var(--berry-bg)", title: "כשיש ילדים בבית", body: "ילדים מוסיפים הוצאות ומנהלים קצבה אישית, בלי לראות את תקציב הבית הכללי." },
];

function Outcomes() {
  return (
    <section id="outcomes" className="pt-section">
      <div className="pt-wrap">
        <div className="pt-shead">
          <span className="pt-eyebrow">מה זה פותר</span>
          <h2>סוף לכאוס של הוצאות, קבלות וקניות</h2>
        </div>
        <div className="pt-outcomes">
          {OUTCOMES.map((o) => (
            <article className="pt-outcome" key={o.title}>
              <span className="pt-outcome__ic" style={{ background: o.bg, color: o.color }}>
                {o.icon}
              </span>
              <h3>{o.title}</h3>
              <p>{o.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ─────────────────────────────────────────────────────────── */
const STEPS = [
  { n: "1", icon: <MessageCircle size={20} color={WA} />, title: "שולחים בוואטסאפ", body: "הוצאה, קבלה או פריט לרשימה - בכתב או בצילום, בצ'אט שכבר פתוח אצלכם." },
  { n: "2", icon: <Sparkles size={20} />, title: "פינג מסדר", body: "מזהה את הסכום, הקטגוריה ומי שלח, ומסדר את זה במקום הנכון." },
  { n: "3", icon: <Home size={20} />, title: "מקבלים תמונת מצב", body: "התובנות מגיעות לוואטסאפ. לדשבורד נכנסים כשרוצים מבט רחב יותר על החודש, הקטגוריות והפרויקטים." },
];

function HowItWorks() {
  return (
    <section id="how" className="pt-section pt-section--alt">
      <div className="pt-wrap">
        <div className="pt-shead pt-shead--center">
          <span className="pt-eyebrow">איך זה עובד</span>
          <h2>שלושה צעדים, בלי ללמוד כלי חדש</h2>
        </div>
        <div className="pt-steps">
          {STEPS.map((s) => (
            <article className="pt-step" key={s.n}>
              <div className="pt-step__top">
                <span className="pt-step__num mono">{s.n}</span>
                <span className="pt-step__ic">{s.icon}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Why WhatsApp ─────────────────────────────────────────────────────────── */
const WHY = [
  { icon: <MessageCircle size={16} />, title: "בלי אפליקציה חדשה", body: "לא צריך להוריד, להירשם וללמוד עוד כלי. הכל קורה בוואטסאפ." },
  { icon: <Users size={16} />, title: "במקום שבו מתאמים ממילא", body: "המשפחה כבר מתכתבת שם על קניות והוצאות - אז גם הסדר נשאר שם." },
  { icon: <Send size={16} />, title: "פעולה קטנה, לא פרויקט", body: "הודעה אחת קצרה, ולא עוד מטלה שמצטברת לסוף החודש." },
];

function WhyWhatsApp() {
  return (
    <section id="why" className="pt-section">
      <div className="pt-wrap pt-why">
        <div>
          <span className="pt-eyebrow">למה דווקא בוואטסאפ</span>
          <h2 style={{ fontSize: "clamp(26px,3vw,36px)", marginTop: 14 }}>
            התקציב לא צריך להיות עוד משימה
          </h2>
          <div className="pt-why__list">
            {WHY.map((w) => (
              <div className="pt-why__item" key={w.title}>
                <span className="ic">{w.icon}</span>
                <p>
                  <b>{w.title}</b> - {w.body}
                </p>
              </div>
            ))}
          </div>
        </div>
        <figure className="pt-why__quote" style={{ margin: 0 }}>
          <div className="q">שתי שניות בוואטסאפ עכשיו, הרבה פחות בלאגן בסוף החודש.</div>
          <figcaption className="by">
            <PingtallyMark size={26} bubble="#A7E8D2" /> העיקרון שמאחורי Pingtally
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ── Comparison band ──────────────────────────────────────────────────────── */
function Comparison() {
  return (
    <section id="compare" className="pt-section pt-compare">
      <div className="pt-wrap pt-compare__in">
        <span className="pt-eyebrow" style={{ justifyContent: "center" }}>
          לא עוד דוח בדיעבד
        </span>
        <h2>רגע קטן של מודעות בזמן אמת</h2>
        <p>
          Pingtally לא מנסה להיות דוח אוטומטי על מה שכבר קרה. הוא עוזר לכם לנהל את הכסף תוך כדי
          החיים, במודעות, בלי חיבור לבנק - מהמקום שבו אתם כבר מדברים.
        </p>
        <div className="pt-compare__cards">
          <div className="pt-compare__card is-muted">
            <span className="pt-compare__tag">בדיעבד</span>
            <p>אפליקציה שמתחברת לבנק מראה לכם בסוף החודש מה כבר קרה, אחרי שהכסף יצא.</p>
          </div>
          <div className="pt-compare__vs">לעומת</div>
          <div className="pt-compare__card is-brand">
            <span className="pt-compare__tag">בזמן אמת</span>
            <p>Pingtally מעדכן תוך כדי החיים, מהמקום שבו אתם כבר מדברים, בלי חיבור לבנק.</p>
          </div>
        </div>
        <div className="pt-compare__note">
          קטגוריה אחרת - לא תחליף לבנק, אלא שכבת סדר ושליטה מעל היומיום.
        </div>
      </div>
    </section>
  );
}

/* ── Trust (dark, before pricing) ─────────────────────────────────────────── */
const TRUST = [
  { icon: <KeyRound size={18} />, title: "כניסה בוואטסאפ, בלי סיסמה", body: "קישור כניסה חד-פעמי בוואטסאפ, בלי עוד סיסמה לזכור." },
  { icon: <Lock size={18} />, title: "הדשבורד נפתח רק אחרי כניסה מאומתת", body: "הגישה למידע דורשת כניסה מאומתת." },
  { icon: <Eye size={18} />, title: "כל אחד רואה רק את מה שמותר לו", body: "ההרשאות נקבעות לכל בן בית." },
  { icon: <User size={18} />, title: "הוצאות אישיות נשארות אישיות", body: "מה שמסומן אישי לא מופיע בתמונה המשותפת." },
  { icon: <Users size={18} />, title: "ילדים מוסיפים, בלי לראות את התקציב", body: "הם משתתפים בלי לראות את תקציב הבית הכללי." },
  { icon: <ShieldCheck size={18} />, title: "כניסה מאובטחת וחיבור מוצפן", body: "התקשורת ביניכם לבין השירות מוצפנת, והגישה לדשבורד דורשת כניסה מאומתת." },
  { icon: <Sparkles size={18} />, title: "AI עוזר, אבל לא מייעץ", body: "ה-AI עוזר לקרוא קבלות ולסווג הוצאות, ולא נותן ייעוץ פיננסי." },
  { icon: <Tag size={18} />, title: "המידע לא נמכר לאף אחד", body: "המידע משמש כדי לתת לכם את השירות, לא להימכר." },
];

function Trust() {
  return (
    <section id="trust" className="pt-section pt-trust">
      <div className="pt-wrap">
        <div className="pt-shead">
          <span className="pt-eyebrow">אמון, פרטיות ואבטחה</span>
          <h2>בנוי כדי שתרגישו בטוחים לשתף</h2>
          <p className="pt-trust__intro">
            הנה איך אנחנו שומרים על המידע שלכם, ולמה אתם בשליטה על מה שנכנס פנימה.
          </p>
        </div>
        <div className="pt-trust__grid">
          {TRUST.map((t) => (
            <div className="pt-trust__item" key={t.title}>
              <span className="ic">{t.icon}</span>
              <div>
                <b>{t.title}</b>
                <p>{t.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-trust__foot">
          <span>אפשר לבקש מחיקת חשבון בכל עת</span>
          <span>·</span>
          <span>אין צורך לחבר חשבון בנק</span>
          <span>·</span>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/terms">תנאי שימוש</Link>
        </div>
      </div>
    </section>
  );
}

/* ── Audience strip ───────────────────────────────────────────────────────── */
const AUDIENCE = [
  { icon: <User size={20} />, color: "var(--teal-dark)", bg: "var(--teal-bg)", title: "אדם אחד", body: "לעקוב לבד אחרי ההוצאות והקבלות." },
  { icon: <Users size={20} />, color: "var(--coral-dark)", bg: "var(--coral-bg)", title: "זוג", body: "לנהל יחד את ההוצאות המשותפות." },
  { icon: <Home size={20} />, color: "var(--mustard-dark)", bg: "var(--mustard-bg)", title: "משפחה", body: "כל בני הבית באותו מקום." },
  { icon: <Users size={20} />, color: "var(--plum)", bg: "var(--plum-bg)", title: "הורים וילדים", body: "ילדים מוסיפים ולומדים לנהל כסף." },
  { icon: <Users size={20} />, color: "var(--ocean)", bg: "var(--ocean-bg)", title: "דירת שותפים", body: "להתחלק בהוצאות הבית בלי בלאגן." },
  { icon: <Folder size={20} />, color: "var(--berry)", bg: "var(--berry-bg)", title: "כל מסגרת משותפת", body: "כל קבוצה שרוצה לדעת לאן הכסף הולך." },
];

function Audience() {
  return (
    <section id="who" className="pt-section pt-section--alt">
      <div className="pt-wrap">
        <div className="pt-shead">
          <span className="pt-eyebrow">למי זה מתאים</span>
          <h2>מתאים לכל בית - ולכל אחד</h2>
          <p>מתאים ליחיד, זוג, משפחה או דירת שותפים.</p>
        </div>
        <div className="pt-who-strip">
          {AUDIENCE.map((a) => (
            <div className="pt-who-seg" key={a.title}>
              <span className="ic" style={{ background: a.bg, color: a.color }}>
                {a.icon}
              </span>
              <div>
                <b>{a.title}</b>
                <p>{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── What you get + insights ──────────────────────────────────────────────── */
const GET = [
  { icon: <Wallet size={18} />, color: "var(--teal-dark)", bg: "var(--teal-bg)", title: "הוצאות בהודעה", body: "כותבים סכום, וזה נכנס לקטגוריה." },
  { icon: <Camera size={18} />, color: "var(--plum)", bg: "var(--plum-bg)", title: "צילום קבלות", body: "מצלמים, וה-AI עוזר לקרוא ולסווג." },
  { icon: <ShoppingCart size={18} />, color: "var(--mustard-dark)", bg: "var(--mustard-bg)", title: "רשימת קניות", body: "כל הבית מוסיף, מסודר לפי קטגוריות." },
  { icon: <Target size={18} />, color: "var(--coral-dark)", bg: "var(--coral-bg)", title: "תקציבי פרויקטים", body: "תקציב נפרד לכל פרויקט." },
  { icon: <Users size={18} />, color: "var(--ocean)", bg: "var(--ocean-bg)", title: "הרשאות לבני בית", body: "מי רואה מה, ומי יכול מה." },
  { icon: <Sparkles size={18} />, color: "var(--berry)", bg: "var(--berry-bg)", title: "סיכום שבועי", body: "תמונת מצב קצרה פעם בשבוע." },
  { icon: <Activity size={18} />, color: "var(--teal-dark)", bg: "var(--teal-bg)", title: "דשבורד לעומק", body: "מבט רחב על החודש והקטגוריות." },
];

const INSIGHTS = [
  { title: "חשמל", sub: "הערכתם ₪800, בפועל ₪700", tag: "100 ₪-", down: true },
  { title: "סופר ומזון", sub: "לעומת החודש שעבר", tag: "12%-", down: true },
  { title: "חיוב קבוע", sub: "פינג סימן שינוי לעומת ההערכה", tag: "שינוי", down: false },
];

function WhatYouGet() {
  return (
    <section id="get" className="pt-section">
      <div className="pt-wrap">
        <div className="pt-shead">
          <span className="pt-eyebrow">מה מקבלים בפועל</span>
          <h2>כלי ניהול אמיתי שחי בוואטסאפ</h2>
        </div>
        <div className="pt-get-panel">
          <div className="pt-get-list">
            {GET.map((g) => (
              <div className="pt-get-row" key={g.title}>
                <span className="ic" style={{ background: g.bg, color: g.color }}>
                  {g.icon}
                </span>
                <div>
                  <b>{g.title}</b>
                  <p>{g.body}</p>
                </div>
              </div>
            ))}
          </div>
          <aside className="pt-insights">
            <div className="pt-insights__head">
              <span className="ic">
                <TrendingUp size={18} />
              </span>
              <div>
                <b>תובנות שמראות שינוי</b>
                <span>פינג מסמן שינויים לעומת ההערכות שלכם, כדי שתוכלו להגיב בזמן.</span>
              </div>
            </div>
            {INSIGHTS.map((ins) => (
              <div className="pt-insight" key={ins.title}>
                <div className="pt-insight__l">
                  <b>{ins.title}</b>
                  <span>{ins.sub}</span>
                </div>
                <span className={`pt-insight__tag ${ins.down ? "is-down" : "is-flag"}`}>
                  {ins.down ? <TrendingDown size={13} /> : <Sparkles size={13} />}
                  <span className="mono">{ins.tag}</span>
                </span>
              </div>
            ))}
            <p className="pt-insights__foot">
              לא נזיפה - תמונת מצב רגועה שעוזרת להישאר בשליטה.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */
function Faq() {
  return (
    <section id="faq" className="pt-section pt-section--alt">
      <div className="pt-wrap">
        <div className="pt-shead pt-shead--center">
          <span className="pt-eyebrow">שאלות נפוצות</span>
          <h2>קודם כל - מה שחשוב לדעת לפני שמתחילים</h2>
        </div>
        <LandingFaq />
      </div>
    </section>
  );
}

/* ── Final CTA ────────────────────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="pt-section">
      <div className="pt-wrap">
        <div className="pt-final">
          <div>
            <h2>נסו 20 יום בחינם, בלי כרטיס אשראי כדי להתחיל</h2>
            <p>קישור כניסה אחד בוואטסאפ, וכל הבית בפנים.</p>
            <div className="pt-final__chips">
              <span>
                <MessageCircle size={14} /> כניסה בוואטסאפ
              </span>
              <span>
                <KeyRound size={14} /> בלי סיסמה
              </span>
              <span>
                <CreditCard size={14} /> בלי כרטיס אשראי להתחלה
              </span>
            </div>
          </div>
          <div className="pt-final__cta">
            <MagicLinkForm variant="compact" idPrefix="final" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="pt-footer">
      <div className="pt-wrap">
        <div className="pt-footer__top">
          <div>
            <PingtallyLockup size={40} />
            <p className="pt-footer__tag">
              ניהול הוצאות, קבלות, קניות ותקציבים מתוך וואטסאפ - לאדם אחד, לזוג, למשפחה או לדירת
              שותפים.
            </p>
          </div>
          <nav className="pt-footer__links" aria-label="קישורי תחתית">
            <Link href="/privacy">מדיניות פרטיות</Link>
            <Link href="/terms">תנאי שימוש</Link>
            <a href="#faq">שאלות נפוצות</a>
            <Link href="/dashboard">כניסה לחשבון</Link>
          </nav>
        </div>
        <div className="pt-footer__meta">
          <div className="pt-footer__contact">
            <a href="mailto:office@pingtally.com">office@pingtally.com</a>
          </div>
          <div>Pingtally · ע.מ. 300520327 · בני ברק · © 2026 כל הזכויות שמורות</div>
        </div>
        <p className="pt-footer__seo">
          Pingtally היא אפליקציה לניהול כלכלת הבית וקופה משפחתית חכמה - ניהול הוצאות, קבלות,
          רשימת קניות ותקציבים מתוך וואטסאפ, בעברית.
        </p>
      </div>
    </footer>
  );
}

export function MarketingLanding() {
  return (
    <div className="pt-root">
      <a href="#start" className="pt-skip">
        דילוג לטופס ההרשמה
      </a>
      <LandingNav />
      <main>
        <Hero />
        <Outcomes />
        <HowItWorks />
        <WhyWhatsApp />
        <Comparison />
        <Trust />
        <Audience />
        <WhatYouGet />
        <PricingPlans />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <LandingJsonLd />
    </div>
  );
}
