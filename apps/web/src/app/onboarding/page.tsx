"use client";

import type { ReactElement } from "react";
import { Home, UserPlus } from "lucide-react";
import Link from "next/link";
import { computeTotals, type StepKey } from "../../lib/onboarding/model";
import { WhatsAppCtaButton, botWhatsAppLink } from "../../components/WhatsAppCta";
import { useOnboardingWizard } from "./useOnboardingWizard";
import {
  WelcomeStep, ProfileStep, SeparateAccountsStep, CycleStep, IncomeStep, FixedStep, BudgetStep, AlertsStep, type StepProps
} from "./steps";
import styles from "./onboarding.module.css";

const STEP_META: Record<StepKey, { title: string; sub: string }> = {
  welcome: { title: "ברוכים הבאים לפינגטלי", sub: "כמה שאלות קצרות ונכין תקציב שמתנהל בוואטסאפ." },
  profile: { title: "קצת על הבית שלכם", sub: "כדי שנדע איך לבנות את התקציב נכון." },
  separate: { title: "איך הכספים מתנהלים", sub: "אפשר להפריד כספים ועדיין לנהל הוצאות משותפות." },
  cycle: { title: "איך החודש הכלכלי עובד", sub: "מתי מתחדש התקציב שלכם." },
  income: { title: "כמה כסף נכנס - וכמה לנהל", sub: "אפשר להזין הכנסה, או רק תקציב חודשי לניהול." },
  fixed: { title: "מה כבר חייב לצאת כל חודש", sub: "ההוצאות הקבועות - שכירות, חשבונות, מנויים ועוד." },
  budget: { title: "התקציב לניהול וחלוקה לקטגוריות", sub: "מאשרים את הסכום החודשי, ואפשר לחלק אותו." },
  alerts: { title: "מתי שנעדכן אתכם", sub: "בוחרים אילו התראות תרצו לקבל." },
  done: { title: "התקציב מוכן 🎉", sub: "" }
};

const STEP_COMPONENTS: Record<Exclude<StepKey, "done">, (props: StepProps) => ReactElement> = {
  welcome: WelcomeStep,
  profile: ProfileStep,
  separate: SeparateAccountsStep,
  cycle: CycleStep,
  income: IncomeStep,
  fixed: FixedStep,
  budget: BudgetStep,
  alerts: AlertsStep
};

export default function OnboardingPage() {
  const wizard = useOnboardingWizard();

  if (!wizard.ready) {
    return (
      <div className="login-page">
        <main id="main">
          {/* Live region wraps (not replaces) the heading so the h1 keeps its
              heading role; inline resets keep the pixels identical to the <p>. */}
          <div role="status">
            <h1 className="muted" style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit" }}>טוען…</h1>
          </div>
        </main>
      </div>
    );
  }

  // ── Completion screen (preserves the existing wa.me cold-start CTA behavior) ──
  if (wizard.done) {
    const hasWhatsAppCta = Boolean(botWhatsAppLink());
    // `CC_UX_BUILD` item 4, spec screen C — **"מי עוד בבית? בלי צד שני אין מה לחלק."**
    //
    // A household that answered "בנפרד" has stored a ratio naming one person, and that ratio does
    // nothing at all until a second adult joins: the arrangement is not declared, no expense
    // splits, and every separate-accounts surface reads as off. So this screen leads with the one
    // action that makes the answer real, instead of the generic "add family members" CTA.
    //
    // ⚠️ IT LINKS TO THE INVITE SURFACE RATHER THAN CLONING IT. The spec draws a phone field here;
    // `/settings/members` already is that field, with the country-code handling, the duplicate and
    // limit refusals and their Hebrew. A second copy of an invite form is a second place for those
    // refusals to be wrong, and the screen asks the same question and offers the same two answers
    // either way. Recorded as a deviation from the drawing, not from the intent.
    const separate = wizard.state.separateAccounts;
    return (
      <div className="login-page">
        <main id="main" className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}><span aria-hidden>🏠</span></div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>הבית מוכן!</h1>
          {/* The post-completion writes report here, because this screen is where a first-time
              household lands and the wizard footer that normally shows a notice is gone by now.
              §A60: what did not save has to be said where the person can still act on it. */}
          {wizard.notice && (
            <p className="status warn" role="status" style={{ display: "block", textAlign: "start", marginBottom: 18 }}>
              {wizard.notice}
            </p>
          )}
          {separate ? (
            <>
              <h2 style={{ fontSize: 17, marginBottom: 6 }}>מי עוד בבית?</h2>
              <p className="muted" style={{ marginBottom: 22 }}>
                בלי צד שני אין מה לחלק. ההוצאות המשותפות מתחילות להתחלק ברגע שבן/בת הזוג מצטרפים.
              </p>
            </>
          ) : hasWhatsAppCta ? (
            <p className="muted" style={{ marginBottom: 22 }}>
              פינגטלי עובד בוואטסאפ - שלחו לבוט הודעה ראשונה, וכל ההוצאות והקניות יתנהלו משם.
            </p>
          ) : (
            <p className="muted" style={{ marginBottom: 22 }}>הצעד הבא - הוסיפו בני משפחה כדי להתחיל לעקוב יחד אחרי התקציב.</p>
          )}
          <div className="form" style={{ marginInline: "auto" }}>
            {separate && (
              <Link className="button" href="/settings/members" style={{ textDecoration: "none" }}>
                <UserPlus size={18} aria-hidden />
                שליחת הזמנה
              </Link>
            )}
            <WhatsAppCtaButton />
            {!separate && wizard.householdType === "family" && (
              <Link className={`button${hasWhatsAppCta ? " secondary" : ""}`} href="/settings/members" style={{ textDecoration: "none" }}>
                <UserPlus size={18} aria-hidden />
                הוסיפו בני משפחה
              </Link>
            )}
            <Link className="button secondary" href="/dashboard" style={{ textDecoration: "none" }}>
              <Home size={18} aria-hidden />
              {separate ? "אחר כך" : "לדשבורד"}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // In edit mode the welcome step is reframed as "update your details" rather than a
  // first-time greeting (the wizard prefilled every field from the saved baseline).
  const meta =
    wizard.editMode && wizard.stepKey === "welcome"
      ? { title: "עדכון פרטי משק הבית", sub: "כל הפרטים כבר מלאים - אפשר לעבור ולעדכן מה שצריך." }
      : STEP_META[wizard.stepKey];
  const StepComponent = STEP_COMPONENTS[wizard.stepKey as Exclude<StepKey, "done">];
  const totals = computeTotals(wizard.state);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.stepMeta}>
            <span className={styles.stepTitle}>{meta.title}</span>
            <span className={styles.stepCount}>{wizard.stepIndex}/{wizard.stepCount}</span>
          </div>
          <div className={styles.segs} aria-hidden>
            {Array.from({ length: wizard.stepCount }).map((_, i) => {
              const pos = i + 1;
              const cls = pos < wizard.stepIndex ? `${styles.seg} ${styles.done}` : pos === wizard.stepIndex ? `${styles.seg} ${styles.active}` : styles.seg;
              return <span key={i} className={cls} />;
            })}
          </div>
        </div>
      </header>

      <main id="main" className={styles.scroll}>
        <div className={`${styles.content} ${styles.contentInner}`}>
          <h1 className={styles.stepHeading}>{meta.title}</h1>
          {meta.sub && <p className={styles.stepSub}>{meta.sub}</p>}
          <StepComponent state={wizard.state} set={wizard.set} totals={totals} />
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          {wizard.error && <div className="status error" role="alert" style={{ marginBottom: 10, display: "inline-block" }}>{wizard.error}</div>}
          {/* SEPACCT §A60 — a save that succeeded and did not store everything. A status, not an
              error: the rest really was saved. `role="status"` so it is announced without the alarm. */}
          {wizard.notice && <div className="status" role="status" style={{ marginBottom: 10, display: "inline-block" }}>{wizard.notice}</div>}
          <div className={`${styles.footerRow} a11y-sticky-cta`}>
            {wizard.stepIndex > 1 ? (
              <button type="button" className="button secondary" onClick={wizard.back} disabled={wizard.working}>חזרה</button>
            ) : <span />}
            <span className={styles.grow} />
            {wizard.canSkip && (
              <button type="button" className={styles.skip} onClick={wizard.skip} disabled={wizard.working}>דלגו</button>
            )}
            <button type="button" className="button" onClick={wizard.next} disabled={wizard.working}>
              {wizard.working ? "שומר…" : wizard.primaryLabel}
            </button>
          </div>
          {/* Saving disables every footer button, so focus is dropped and the
              label change alone is never announced. */}
          <span className="sr-only" role="status">{wizard.working ? "שומר…" : ""}</span>
        </div>
      </footer>
    </div>
  );
}
