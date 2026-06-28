"use client";

import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

// Pingtally is WhatsApp-first, but a brand-new WEB signup has never messaged the
// bot - so Meta's 24h customer-service window is closed and every free-form
// message the backend sends them dies with error 131047 (2026-06-12 incident:
// participants finished onboarding and the bot stayed silent = "the app is
// stuck"). This CTA has the USER send the first message, which opens the window
// from their side - no Meta template approval required.
//
// NEXT_PUBLIC_* is inlined at BUILD time; when the env var is unset the CTA
// renders nothing (deploys safely before the number is configured).
const BOT_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER ?? "").replace(/\D/g, "");
const PREFILL_TEXT = "היי פינגטלי 👋";

export function botWhatsAppLink(): string | null {
  if (!BOT_NUMBER) return null;
  return `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(PREFILL_TEXT)}`;
}

/** Primary "send the first WhatsApp message" button. Renders nothing when the bot number is not configured. */
export function WhatsAppCtaButton({ label = "שליחת הודעה ראשונה בוואטסאפ" }: { label?: string }) {
  const link = botWhatsAppLink();
  if (!link) return null;
  return (
    <a className="button" href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <MessageCircle size={18} aria-hidden />
      {label}
    </a>
  );
}

const DISMISS_KEY = "pt-whatsapp-cta-dismissed";

/**
 * Dismissible dashboard banner shown while the household has no activity yet -
 * the actionable bridge for users who already skipped the onboarding completion
 * screen (the empty activity feed only *mentions* WhatsApp; nothing tells the
 * user the FIRST message has to come from them).
 */
export function WhatsAppCtaBanner() {
  const link = botWhatsAppLink();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!link || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage unavailable (private mode) - dismiss for this view only.
    }
  }

  return (
    <section
      className="card"
      data-testid="whatsapp-cta-banner"
      style={{
        padding: "var(--sp-4) var(--sp-5)",
        marginBottom: "var(--sp-6)",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        flexWrap: "wrap"
      }}
    >
      <span style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">💬</span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>עוד לא דיברתם עם הבוט?</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          שלחו הודעה ראשונה בוואטסאפ - ומשם רושמים הוצאות, מנהלים קניות ומתעדכנים.
        </div>
      </div>
      <a
        className="button"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", flexShrink: 0 }}
      >
        <MessageCircle size={18} aria-hidden />
        שליחת הודעה ראשונה
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגירה"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-2, #888)",
          padding: 4,
          flexShrink: 0
        }}
      >
        <X size={18} aria-hidden />
      </button>
    </section>
  );
}
