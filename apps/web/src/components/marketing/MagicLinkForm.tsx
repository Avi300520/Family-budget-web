"use client";

// Pingtally hero / final-CTA conversion form: sends a REAL WhatsApp magic-link.
// Reuses the existing, proven flow (api.requestMagicLink + the 199-country
// PhoneInput + reading ?next= from window.location.search at submit time so the
// whole landing still prerenders to static HTML instead of bailing to CSR).
//
// States: idle | invalid | loading | sent | error | ratelimit. The ratelimit
// state is only shown when the backend actually returns 429 - never fabricated.
// Privacy: the phone number is never logged and never sent to analytics.

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Loader2, MessageCircle, Send, TriangleAlert } from "lucide-react";
import { ApiClientError } from "@shopping-assistant/api-client";
import { api } from "../../lib/api";
import { PhoneInput } from "../PhoneInput";
import { DEFAULT_COUNTRY_ISO, dialForIso, toE164 } from "../../lib/countryCodes";

type Variant = "hero" | "compact";

export function MagicLinkForm({
  variant = "hero",
  idPrefix = "pt",
}: {
  variant?: Variant;
  idPrefix?: string;
}) {
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [fieldErr, setFieldErr] = useState<string>();
  const [banner, setBanner] = useState<"error" | "ratelimit">();
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const inputId = `${idPrefix}-phone`;

  async function submit() {
    if (inFlight.current) return; // never fire two magic-link sends at once
    setFieldErr(undefined);
    setBanner(undefined);
    // Read ?next= lazily at submit (client event), NOT useSearchParams, so the
    // landing prerenders statically instead of opting into CSR.
    const next = new URLSearchParams(window.location.search).get("next") ?? undefined;
    const e164 = toE164(dialForIso(countryIso), phone);
    if (!e164) {
      setFieldErr("צריך מספר טלפון נייד תקין");
      return;
    }
    inFlight.current = true;
    setWorking(true);
    try {
      await api.requestMagicLink(e164, next);
      setSentTo(e164);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        setBanner("ratelimit");
      } else {
        setBanner("error");
      }
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }

  if (sentTo) {
    return (
      <div
        className="pt-form"
        style={{ background: "var(--teal-bg)", borderColor: "var(--teal-soft)" }}
        role="status"
        aria-live="polite"
      >
        <div className="pt-form__sent">
          <span className="pt-form__sent-ic">
            <MessageCircle size={22} />
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-0)" }}>
              שלחנו לכם קישור כניסה בוואטסאפ
            </div>
            <div style={{ fontSize: 14, color: "var(--text-1)", marginTop: 5, lineHeight: 1.55 }}>
              לחיצה על הקישור תפתח את הדשבורד. הקישור תקף ל-15 דקות, בלי סיסמה ובלי הורדה.
            </div>
            <div className="mono" dir="ltr" style={{ fontSize: 13, marginTop: 9, color: "var(--text-2)" }}>
              {sentTo}
            </div>
            <button
              type="button"
              onClick={() => setSentTo(undefined)}
              className="pt-btn pt-btn--ghost pt-btn--sm"
              style={{ marginTop: 14 }}
            >
              שליחה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="pt-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <label className="pt-form__label" htmlFor={inputId}>
        מספר הטלפון שלכם
      </label>

      {banner === "error" && (
        <div className="pt-form__banner is-error" role="alert">
          <TriangleAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <b>לא הצלחנו לשלוח את הקישור</b>
            אפשר לבדוק את החיבור ולנסות שוב.
          </span>
        </div>
      )}
      {banner === "ratelimit" && (
        <div className="pt-form__banner is-warn" role="alert">
          <TriangleAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <b>כבר שלחנו קישור</b>
            אפשר לבקש קישור חדש בעוד רגע.
          </span>
        </div>
      )}

      <PhoneInput
        id={inputId}
        countryIso={countryIso}
        onCountryChange={(iso) => {
          setCountryIso(iso);
          setFieldErr(undefined);
        }}
        phone={phone}
        onPhoneChange={(v) => {
          setPhone(v);
          setFieldErr(undefined);
        }}
        phoneAriaLabel="מספר הטלפון שלכם"
        disabled={working}
        invalid={Boolean(fieldErr)}
      />
      {fieldErr && (
        <div className="pt-form__err" role="alert">
          <TriangleAlert size={15} /> {fieldErr}
        </div>
      )}

      <button
        type="submit"
        disabled={working}
        className="pt-btn pt-btn--primary pt-btn--block pt-btn--lg pt-form__submit"
      >
        {working ? (
          <>
            <Loader2 size={18} className="pt-spin" /> שולחים קישור…
          </>
        ) : banner === "ratelimit" ? (
          <>
            <Send size={18} /> שליחת קישור חדש
          </>
        ) : (
          <>
            <MessageCircle size={18} /> מתחילים בחינם בוואטסאפ
          </>
        )}
      </button>

      <p className="pt-form__sub">
        נשלח לכם קישור כניסה בוואטסאפ - בלי סיסמה, בלי הורדה.
      </p>

      {variant === "hero" && (
        <div className="pt-form__legal">
          בהתחלה אתם מאשרים את{" "}
          <Link href="/terms">תנאי השימוש</Link> ו<Link href="/privacy">מדיניות הפרטיות</Link>.
        </div>
      )}

      {variant === "hero" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            marginTop: 12,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <MessageCircle size={13} color="var(--wa)" /> כניסה בוואטסאפ
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Check size={13} /> בלי סיסמה
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Check size={13} /> בלי הורדה
          </span>
        </div>
      )}
    </form>
  );
}
