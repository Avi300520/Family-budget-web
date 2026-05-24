"use client";

import { CreditCard, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import type { Household, Subscription } from "@shopping-assistant/shared-types";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import { api } from "../../lib/api";

export default function BillingPage() {
  const [household, setHousehold] = useState<Household>();
  const [subscription, setSubscription] = useState<Subscription>();
  const [checkoutSessionId, setCheckoutSessionId] = useState<string>();
  const [error, setError] = useState<string>();
  const planCode = "plus_monthly";

  async function load() {
    try {
      const current = await api.currentHousehold();
      setHousehold(current.household);
      setSubscription((await api.subscription()).subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת מנוי");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCheckout() {
    if (!household) return;
    const session = await api.checkoutSession(household.id, planCode);
    setCheckoutSessionId(session.checkoutSessionId);
    if (session.checkoutUrl && !session.checkoutUrl.includes("localhost") && !session.checkoutUrl.includes("mock")) {
      window.location.href = session.checkoutUrl;
    }
  }

  async function activateMockPayment() {
    if (!household) return;
    await api.mockPaymentWebhook(household.id, planCode, checkoutSessionId ?? `manual_${Date.now()}`);
    await load();
  }

  if (error) return <AppShell><LoadState error={error} /></AppShell>;
  if (!household) return <AppShell><LoadState /></AppShell>;

  return (
    <AppShell>
      <h1 className="page-title">תשלום ומנוי</h1>
      <section className="grid two">
        <div className="panel">
          <h2>מסלול נוכחי</h2>
          <div className="metric">{subscription?.planCode ?? "trial"}</div>
          <div className="muted">{subscription?.status ?? "trialing"}</div>
        </div>
        <div className="panel">
          <h2>Plus</h2>
          <div className="metric">19.90 ש"ח</div>
          <div className="row">
            <button className="button secondary" onClick={createCheckout}>
              <CreditCard size={18} aria-hidden />
              יצירת checkout
            </button>
            <button className="button" onClick={activateMockPayment}>
              <Webhook size={18} aria-hidden />
              הפעלת webhook
            </button>
          </div>
          {checkoutSessionId && <div className="status">checkout {checkoutSessionId.slice(0, 8)}</div>}
        </div>
      </section>
    </AppShell>
  );
}
