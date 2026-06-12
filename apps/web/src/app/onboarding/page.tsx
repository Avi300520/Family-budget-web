"use client";

import { CheckCircle2, Home, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../lib/api";
import { WhatsAppCtaButton, botWhatsAppLink } from "../../components/WhatsAppCta";

type HouseholdType = "single" | "couple" | "family";

const HOUSEHOLD_LABELS: Record<HouseholdType, string> = {
  single: "יחיד",
  couple: "זוג",
  family: "משפחה"
};

export default function OnboardingPage() {
  const router = useRouter();
  const [householdType, setHouseholdType] = useState<HouseholdType>("single");
  const [displayName, setDisplayName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [monthlyBudgetAmount, setMonthlyBudgetAmount] = useState<number | "">(5000);
  const [budgetCycleDay, setBudgetCycleDay] = useState<number>(1);
  const [defaultCity, setDefaultCity] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const canSubmit = displayName.trim() && householdName.trim() && monthlyBudgetAmount && defaultCity.trim() && acceptTerms && acceptPrivacy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(undefined);
    try {
      await api.completeOnboarding({
        displayName: displayName.trim(),
        householdName: householdName.trim(),
        monthlyBudgetAmount: Number(monthlyBudgetAmount),
        defaultCity: defaultCity.trim(),
        budgetCycleDay,
        acceptTerms: true,
        acceptPrivacy: true
      });
      // 2026-06-12 cold-start fix: a web-first signup has never messaged the bot, so
      // the bot CANNOT message them first (Meta 131047 outside the 24h window). The
      // completion screen's WhatsApp CTA has the user open the window — show it for
      // EVERY household type when the bot number is configured. Without a configured
      // number the pre-fix behavior is preserved (family screen / straight to dashboard).
      if (householdType === "family" || botWhatsAppLink()) {
        setDone(true);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לסיים את ההגדרה. נסה שוב.");
    }
  }

  if (done) {
    const hasWhatsAppCta = Boolean(botWhatsAppLink());
    return (
      <div className="login-page">
        <section className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>הבית מוכן!</h1>
          {hasWhatsAppCta ? (
            <p className="muted" style={{ marginBottom: 22 }}>
              פינגטלי עובד בוואטסאפ — שלחו לבוט הודעה ראשונה, וכל ההוצאות והקניות יתנהלו משם.
            </p>
          ) : (
            <p className="muted" style={{ marginBottom: 22 }}>הצעד הבא — הוסף בני משפחה כדי להתחיל לעקוב יחד אחרי התקציב.</p>
          )}
          <div className="form" style={{ marginInline: "auto" }}>
            <WhatsAppCtaButton />
            {householdType === "family" && (
              <Link className={`button${hasWhatsAppCta ? " secondary" : ""}`} href="/settings/members" style={{ textDecoration: "none" }}>
                <UserPlus size={18} aria-hidden />
                הוסף בני משפחה
              </Link>
            )}
            <Link className="button secondary" href="/dashboard" style={{ textDecoration: "none" }}>
              <Home size={18} aria-hidden />
              לדשבורד בינתיים
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="login-page">
      <section className="login-box">
        <h1 className="page-title">הגדרת בית חדש</h1>
        <p className="muted" style={{ marginTop: -16, marginBottom: 18 }}>נגדיר את התקציב והעדפות הקנייה, וזהו — אפשר להתחיל לחסוך.</p>
        <form className="form" onSubmit={submit}>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>סוג בית</legend>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(Object.keys(HOUSEHOLD_LABELS) as HouseholdType[]).map((type) => (
                <label key={type} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal" }}>
                  <input
                    type="radio"
                    name="householdType"
                    value={type}
                    checked={householdType === type}
                    onChange={() => setHouseholdType(type)}
                  />
                  {HOUSEHOLD_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            השם שלך
            <input
              className="input"
              value={displayName}
              placeholder="השם שלך"
              autoComplete="given-name"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label>
            שם הבית
            <input
              className="input"
              value={householdName}
              placeholder="למשל: משפחת לוי"
              onChange={(event) => setHouseholdName(event.target.value)}
            />
          </label>
          <label>
            תקציב חודשי (₪)
            <input
              className="input"
              type="number"
              min={100}
              max={100000}
              value={monthlyBudgetAmount}
              placeholder="למשל: 5000"
              onChange={(event) => setMonthlyBudgetAmount(event.target.value === "" ? "" : Number(event.target.value))}
            />
          </label>
          <label>
            יום תחילת חודש תקציבי
            <input
              className="input"
              type="number"
              min={1}
              max={28}
              value={budgetCycleDay}
              placeholder="1"
              onChange={(event) => setBudgetCycleDay(Math.min(28, Math.max(1, Number(event.target.value) || 1)))}
            />
            <span className="muted" style={{ fontSize: 13 }}>היום בחודש שבו מתחדש התקציב (1–28). ברירת מחדל: 1.</span>
          </label>
          <label>
            אזור קניות
            <input
              className="input"
              value={defaultCity}
              placeholder="העיר / שכונה שלך"
              onChange={(event) => setDefaultCity(event.target.value)}
            />
          </label>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontWeight: "normal" }}>
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>קראתי ואני מסכים/ה ל<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>תנאי השימוש</a></span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontWeight: "normal" }}>
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>קראתי ואני מסכים/ה ל<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>מדיניות הפרטיות</a></span>
            </label>
          </div>

          <button className="button" type="submit" disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : 0.5 }}>
            <CheckCircle2 size={18} aria-hidden />
            שמירה והמשך
          </button>
          {error && <div className="status error">{error}</div>}
        </form>
      </section>
    </div>
  );
}
