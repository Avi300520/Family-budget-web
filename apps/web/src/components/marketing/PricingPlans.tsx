"use client";

// Pricing: 20-day free trial + monthly/yearly toggle + 3 tiers, calm tone,
// placed AFTER the trust section. No "billing reminder" promise anywhere.
//
// PRICE SYNC: these amounts mirror the backend PLAN_PRICEBOOK that drives real
// checkout (1990/2990/3990 agorot monthly; 19900/29900/39900 yearly). They are
// hardcoded so the marketing root stays static/crawlable and never depends on a
// runtime /plans fetch. A price change is a backend deploy AND an edit here -
// see docs/marketing/landing-page-implementation.md.

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";

interface Tier {
  name: string;
  who: string;
  mo: string;
  yr: string;
  limit: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  { name: "אישי / זוגי", who: "עד 2 משתמשים", mo: "19.90", yr: "199", limit: "עד 40 צילומי קבלות בחודש" },
  { name: "משפחה", who: "עד 4 אנשים בבית", mo: "29.90", yr: "299", limit: "עד 70 צילומי קבלות בחודש", featured: true },
  { name: "משפחה 4+", who: "5 אנשים ומעלה", mo: "39.90", yr: "399", limit: "צילומי קבלות ללא הגבלה" },
];

export function PricingPlans() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="pt-section pt-section--tight">
      <div className="pt-wrap">
        <div className="pt-shead pt-shead--center">
          <span className="pt-eyebrow">מחיר</span>
          <h2>מתחילים בחינם. ממשיכים בלי הפתעות.</h2>
          <p>
            20 יום ניסיון מלא עם כל היכולות פתוחות. אחר כך בוחרים מסלול לפי גודל הבית. מחיר אחד
            לחשבון, לא לכל משתמש.
          </p>
        </div>

        <div className="pt-price-trial">
          <div className="pt-price-trial__l">
            <span className="pt-price-trial__ic">
              <Sparkles size={24} />
            </span>
            <div>
              <b>20 יום חינם, בלי כרטיס אשראי כדי להתחיל</b>
              <p>כל המסלולים פתוחים במלואם, כולל צילומי קבלות ללא הגבלה. בלי התחייבות.</p>
            </div>
          </div>
          <a href="#start" className="pt-btn pt-btn--primary">
            מתחילים בחינם
          </a>
        </div>

        <div className="pt-toggle">
          <div className="pt-toggle__in" role="group" aria-label="מחזור חיוב">
            <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
              חודשי
            </button>
            <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
              שנתי · חיסכון ~17%
            </button>
          </div>
        </div>

        <div className="pt-prices">
          {TIERS.map((t) => (
            <div key={t.name} className={`pt-price${t.featured ? " pt-price--feat" : ""}`}>
              {t.featured && <div className="pt-price__flag">הכי נפוץ</div>}
              <div className="pt-price__name">{t.name}</div>
              <div className="pt-price__who">{t.who}</div>
              <div className="pt-price__amt">
                <span className="cur">₪</span>
                <span className="num">{yearly ? t.yr : t.mo}</span>
                <span className="per">/ {yearly ? "שנה" : "חודש"}</span>
              </div>
              <div className="pt-price__sub">
                {yearly ? `בערך ₪${(Number(t.yr) / 12).toFixed(1)} לחודש` : "חיוב חודשי, בלי התחייבות"}
              </div>
              <ul className="pt-price__list">
                <li>
                  <span className="ic">
                    <Check size={16} />
                  </span>
                  כל היכולות, לכל בני הבית
                </li>
                <li>
                  <span className="ic">
                    <Check size={16} />
                  </span>
                  {t.limit}
                </li>
                <li>
                  <span className="ic">
                    <Check size={16} />
                  </span>
                  אפשר לבטל בכל רגע
                </li>
              </ul>
              <div className="pt-price__cta">
                <a
                  href="#start"
                  className={`pt-btn pt-btn--block${t.featured ? " pt-btn--primary" : " pt-btn--ghost"}`}
                >
                  מתחילים בחינם
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="pt-price__foot">
          המחיר הוא לחשבון, לא לכל משתמש · אפשר לבטל בכל רגע · המחירים כוללים מע״מ.
        </p>
      </div>
    </section>
  );
}
