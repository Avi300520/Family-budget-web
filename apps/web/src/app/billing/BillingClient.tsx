"use client";

import { CheckCircle2, CreditCard, RefreshCw, ShieldAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BILLING_PLANS,
  type BillingInterval,
  type BillingPlan,
  type BillingStatusDto,
  type BillingTier,
  type EffectiveBillingStatus,
  type PaidPlanCode,
  TRIAL_DAYS
} from "@shopping-assistant/shared-types";
import { ApiClientError } from "@shopping-assistant/api-client";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";
import { useViewer } from "../../lib/useViewer";
import { canViewBilling } from "../../lib/settingsView";
import { classifyCheckoutError, isRealCheckoutRedirect, checkoutReturnBanner } from "../../lib/billingCheckoutError";

// ── Hebrew labels (warm, brief) ──────────────────────────────────────────────
const STATUS_LABELS: Record<EffectiveBillingStatus, string> = {
  trialing: "תקופת ניסיון",
  active: "מנוי פעיל",
  trial_expired: "תקופת הניסיון הסתיימה",
  past_due: "התשלום ממתין",
  expired: "המנוי פג",
  cancelled: "המנוי בוטל",
  paused: "המנוי מושהה",
  none: "ללא מנוי"
};

const TIER_LABELS: Record<BillingTier, string> = {
  couple: "זוג",
  family_small: "משפחה עד 3 ילדים",
  family_large: "משפחה 4+ ילדים"
};

const TIER_ORDER: BillingTier[] = ["couple", "family_small", "family_large"];

function shekels(priceAgorot: number): string {
  // Agorot → ₪. Integer prices → no decimals; otherwise 2 places.
  const v = priceAgorot / 100;
  return Number.isInteger(v) ? `₪${v}` : `₪${v.toFixed(2)}`;
}

export default function BillingClient() {
  const viewer = useViewer();
  const params = useSearchParams();
  const returnStatus = params.get("status"); // success | failed | null

  const [householdId, setHouseholdId] = useState<string>();
  const [billing, setBilling] = useState<BillingStatusDto>();
  // The catalog comes from the server when available, falling back to the synced
  // pricebook (BILLING_PLANS) so the page still renders if /plans hiccups.
  const [plans, setPlans] = useState<readonly BillingPlan[]>(BILLING_PLANS);
  const [trialDays, setTrialDays] = useState<number>(TRIAL_DAYS);
  // Default to yearly (annual one-time, no HK). Monthly = HYP recurring (HK) and is intentionally
  // disabled for now (no in-code cancel; needs an operational renewal process before it's offered).
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  // A restricted load (backend 403) is distinct from a transient error - show the
  // owner-managed notice, never a retry loop.
  const [restricted, setRestricted] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState<PaidPlanCode | null>(null);
  const [actionError, setActionError] = useState<string>();
  // Invoice email — required before a paid checkout; prefilled from the household billing profile.
  const [billingEmail, setBillingEmail] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(undefined);
    setRestricted(false);
    (async () => {
      try {
        const current = await api.currentHousehold();
        if (cancelled) return;
        setHouseholdId(current.household.id);
        const [statusRes, plansRes, profileRes] = await Promise.allSettled([api.billingStatus(), api.billingPlans(), api.billingProfile()]);
        if (cancelled) return;
        if (statusRes.status === "fulfilled") {
          setBilling(statusRes.value.billing);
        } else {
          throw statusRes.reason;
        }
        // /plans is best-effort: fall back to the synced pricebook on failure.
        if (plansRes.status === "fulfilled") {
          setPlans(plansRes.value.plans);
          setTrialDays(plansRes.value.trialDays);
        }
        // Prefill the invoice email from the household billing profile (best-effort; owner/admin only).
        if (profileRes.status === "fulfilled" && profileRes.value.billingEmail) {
          setBillingEmail(profileRes.value.billingEmail);
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        // Backend is the source of truth for "you can't see this": billing.forbidden
        // (product role policy) → restricted notice, not an error/retry.
        if (err instanceof ApiClientError && (err.code === "billing.forbidden" || err.status === 403)) {
          setRestricted(true);
          setStatus("ready");
          return;
        }
        setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "שגיאה בטעינת המנוי");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  async function choosePlan(planCode: PaidPlanCode) {
    if (!householdId || checkoutBusy) return;
    // Invoice email is required before a paid checkout (backend re-validates + is authoritative).
    const email = billingEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setActionError("נא להזין אימייל תקין לשליחת החשבונית לפני התשלום.");
      return;
    }
    setCheckoutBusy(planCode);
    setActionError(undefined);
    try {
      const session = await api.checkoutSession(householdId, planCode, email);
      // Redirect to a REAL provider payment page. The dev mock returns an on-site
      // /api/v1/dev/mock-checkout URL (not a payment page); a real HYP page is https://pay.hyp.co.il/…
      // and may embed our own callback URLs, so we must NOT sniff for "localhost"/"mock" (prior bug).
      if (isRealCheckoutRedirect(session.checkoutUrl)) {
        window.location.href = session.checkoutUrl;
        return;
      }
      setActionError("פתיחת התשלום בסביבת בדיקה - בפרודקשן יופנו לעמוד התשלום.");
    } catch (err) {
      // Only a genuine role-authz failure (billing.forbidden) collapses to the owner-only view.
      // billing.disabled (billing OFF) / billing.email_required / other errors stay inline so the
      // plan cards + invoice-email field remain visible. (Prior bug: any 403 collapsed the page.)
      const ui = classifyCheckoutError(err);
      if ("restricted" in ui) setRestricted(true);
      else setActionError(ui.message);
    } finally {
      setCheckoutBusy(null);
    }
  }

  // ── Defense-in-depth role gate (backend 403s too) ──────────────────────────
  // Resolve the viewer first; only owner/admin may manage billing.
  if (viewer.status === "loading" || status === "loading") {
    return <AppShell><h1 className="page-title">תשלום ומסלול</h1><LoadState /></AppShell>;
  }
  if (viewer.status === "ready" && !canViewBilling(viewer.caps)) {
    return (
      <AppShell>
        <h1 className="page-title">תשלום ומסלול</h1>
        <section className="panel">
          <p className="muted">ניהול התשלום והמסלול מתבצע על ידי בעל/ת הבית.</p>
        </section>
      </AppShell>
    );
  }
  if (restricted) {
    return (
      <AppShell>
        <h1 className="page-title">תשלום ומסלול</h1>
        <section className="panel">
          <p className="muted">ניהול התשלום והמסלול מתבצע על ידי בעל/ת הבית.</p>
        </section>
      </AppShell>
    );
  }
  if (status === "error") {
    return (
      <AppShell>
        <h1 className="page-title">תשלום ומסלול</h1>
        <div className="status error" style={{ display: "block", marginBottom: 16 }}>
          {error ?? "לא הצלחנו לטעון את המנוי."}
          <div style={{ marginTop: 10 }}>
            <button className="button secondary" type="button" onClick={() => setNonce((n) => n + 1)}>
              <RefreshCw size={16} aria-hidden /> נסו שוב
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const visiblePlans = plans
    .filter((p) => p.interval === interval)
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  const isTrialing = billing?.effectiveStatus === "trialing";
  // Yearly savings %, derived from the pricebook (yearly is ~ monthly*12*0.83, about 17%).
  // Computed, never hardcoded: the first tier carrying both intervals drives the label.
  const yearlySavingsPct = (() => {
    for (const tier of TIER_ORDER) {
      const m = plans.find((p) => p.interval === "monthly" && p.tier === tier);
      const y = plans.find((p) => p.interval === "yearly" && p.tier === tier);
      if (m && y && m.priceAgorot > 0) {
        const pct = Math.round((1 - y.priceAgorot / (m.priceAgorot * 12)) * 100);
        if (pct > 0) return pct;
      }
    }
    return null;
  })();

  return (
    <AppShell>
      <h1 className="page-title">תשלום ומסלול</h1>

      {/* Return from checkout — the BACKEND subscription status is the source of truth, NOT the
          ?status= hint (incident 2026-07-03: approved payment showed "failed"; stale hint claimed paid). */}
      {checkoutReturnBanner(returnStatus, billing?.effectiveStatus) === "active" && (
        <div className="status success" role="status" style={{ display: "block", marginBottom: 16 }}>
          <CheckCircle2 size={16} aria-hidden /> התשלום התקבל. תודה! המנוי שלכם פעיל.
        </div>
      )}
      {checkoutReturnBanner(returnStatus, billing?.effectiveStatus) === "processing" && (
        <div className="status" role="status" style={{ display: "block", marginBottom: 16 }}>
          קיבלנו את התשלום. אנחנו מעדכנים את המנוי - רעננו את הדף בעוד רגע.
        </div>
      )}
      {checkoutReturnBanner(returnStatus, billing?.effectiveStatus) === "failed" && (
        <div className="status error" role="alert" style={{ display: "block", marginBottom: 16 }}>
          התשלום לא הושלם. אפשר לנסות שוב מטה.
        </div>
      )}

      {/* Upgrade-required banner - driven only by backend billing.upgradeRequired */}
      {billing?.upgradeRequired && (
        <div className="status error" role="alert" style={{ display: "block", marginBottom: 16 }}>
          <ShieldAlert size={16} aria-hidden /> מספר הילדים בבית ({billing.childCount}) מצריך מסלול{" "}
          <strong>{TIER_LABELS[billing.requiredTier]}</strong> ומעלה. שדרגו כדי להמשיך ליהנות מכל היכולות.
        </div>
      )}

      {/* Current plan + status */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <h2>מסלול נוכחי</h2>
        <div className="metric">
          {billing?.tier ? TIER_LABELS[billing.tier] : billing?.effectiveStatus === "trialing" ? "ניסיון" : "-"}
        </div>
        <div className="muted">{billing ? STATUS_LABELS[billing.effectiveStatus] : "-"}</div>
        {isTrialing && typeof billing?.trialDaysRemaining === "number" && (
          <p className="muted" style={{ marginTop: 8 }}>
            נותרו {billing.trialDaysRemaining} ימים מתוך {trialDays} בתקופת הניסיון.
          </p>
        )}
        {billing && (
          <p className="muted" style={{ marginTop: 8 }}>
            המסלול הנדרש למשפחה שלכם: <strong>{TIER_LABELS[billing.requiredTier]}</strong>.
          </p>
        )}
        {/* Usage: receipts (monthly window) + members vs the plan cap. During the trial both
            are unlimited (receiptsPerMonth / memberMax are null) → shown as "ללא הגבלה". */}
        {billing && (
          <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
            <p className="muted">
              צילומי קבלות החודש:{" "}
              {billing.receiptsPerMonth == null ? (
                <strong>ללא הגבלה</strong>
              ) : (
                <strong>
                  {billing.receiptsUsed ?? 0} מתוך {billing.receiptsPerMonth}
                  {billing.receiptsResetAt
                    ? ` · מתאפס ב-${new Date(billing.receiptsResetAt).toLocaleDateString("he-IL")}`
                    : ""}
                </strong>
              )}
            </p>
            <p className="muted">
              בני בית:{" "}
              <strong>
                {typeof billing.memberCount === "number" ? billing.memberCount : "-"}
                {billing.memberMax == null ? "" : ` מתוך ${billing.memberMax}`}
              </strong>
              {billing.memberLimitReached && <span className="muted"> · הגעתם למכסת בני הבית במסלול</span>}
            </p>
          </div>
        )}
      </section>

      {/* Monthly / yearly toggle */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }} role="group" aria-label="בחירת תדירות תשלום">
        {/* Monthly = HYP recurring (HK); disabled until an in-app cancel/renewal process exists so it
            cannot be selected by accident. Annual (one-time) is the only offered path for now. */}
        <button type="button" className="button secondary" disabled aria-pressed={false} title="תשלום חודשי יתווסף בהמשך">
          חודשי (בקרוב)
        </button>
        <button
          type="button"
          className={interval === "yearly" ? "button" : "button secondary"}
          aria-pressed={interval === "yearly"}
          onClick={() => setInterval("yearly")}
        >
          {yearlySavingsPct ? `שנתי · חיסכון ${yearlySavingsPct}%` : "שנתי"}
        </button>
      </div>

      {/* Invoice email — required before checkout; prefilled from the household billing profile.
          Backend re-validates and is authoritative. Owner/admin only (page is restricted otherwise). */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <label htmlFor="billing-email" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          אימייל לשליחת חשבונית
        </label>
        <input
          id="billing-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={billingEmail}
          onChange={(e) => setBillingEmail(e.target.value)}
          placeholder="name@example.com"
          style={{ width: "100%", maxWidth: 360, textAlign: "left" }}
        />
        <p className="muted" style={{ marginTop: 6 }}>
          נשתמש בכתובת הזו רק לצורכי תשלום, חשבוניות ועדכוני חיוב.
        </p>
      </div>

      {/* Plan catalog - 3-up via the responsive .grid.three primitive (collapses to 1 col on mobile) */}
      <section className="grid three">
        {visiblePlans.map((plan) => {
          const isCurrent = billing?.planCode === plan.code;
          // The tier the household must be on (from the backend) is the recommended card.
          const isRecommended = billing?.requiredTier === plan.tier;
          const isYearly = plan.interval === "yearly";
          // Yearly cards show a monthly-equivalent headline (₪round(yearly/12)) + a yearly-billed sub-line.
          const perMonth = isYearly ? Math.round(plan.priceAgorot / 100 / 12) : plan.priceAgorot / 100;
          return (
            <div
              className="panel"
              key={plan.code}
              style={
                isRecommended
                  ? { position: "relative", border: "2px solid var(--teal)", boxShadow: "var(--elev-2)" }
                  : { position: "relative" }
              }
            >
              {isRecommended && (
                <span
                  className="chip teal"
                  style={{ position: "absolute", insetInlineStart: 16, top: -12, fontWeight: 700 }}
                >
                  מומלץ למשפחה שלכם
                </span>
              )}
              <h2>{TIER_LABELS[plan.tier]}</h2>
              <div className="metric">
                ₪{perMonth}
                <span className="muted" style={{ fontSize: "0.6em", fontWeight: 400 }}>
                  {" "}
                  / חודש
                </span>
              </div>
              {isYearly && (
                <p className="muted" style={{ color: "var(--pos)", marginTop: 0 }}>
                  חיוב שנתי · {shekels(plan.priceAgorot)}
                </p>
              )}
              <p className="muted">
                {plan.childrenMax === null
                  ? "ללא הגבלת מספר ילדים."
                  : plan.childrenMax === 0
                    ? "ללא ילדים."
                    : `עד ${plan.childrenMax} ילדים.`}
              </p>
              <div className="row">
                <button
                  className="button"
                  type="button"
                  disabled={checkoutBusy !== null || isCurrent}
                  onClick={() => choosePlan(plan.code)}
                >
                  <CreditCard size={16} aria-hidden />
                  {isCurrent ? "המסלול שלכם" : checkoutBusy === plan.code ? "פותח תשלום..." : "בחירת המסלול"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {actionError && (
        <div className="status error" role="alert" style={{ display: "block", marginTop: 16 }}>
          {actionError}
        </div>
      )}
    </AppShell>
  );
}
