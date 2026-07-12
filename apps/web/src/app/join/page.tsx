"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Household, HouseholdInvite, User } from "@shopping-assistant/shared-types";
import { ApiClientError } from "@shopping-assistant/api-client";
import { api } from "../../lib/api";
import { PhoneInput } from "../../components/PhoneInput";
import { DEFAULT_COUNTRY_ISO, dialForIso, toE164 } from "../../lib/countryCodes";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  adult_member: "חבר מבוגר",
  limited_member: "בן/בת בית"
};

type Phase = "loading" | "auth" | "link_sent" | "preview" | "joining" | "done" | "error";

// Inner component — must be inside <Suspense> because it calls useSearchParams()
function JoinPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [invite, setInvite] = useState<HouseholdInvite>();
  const [household, setHousehold] = useState<Household>();
  const [currentUser, setCurrentUser] = useState<User>();
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  // Cold recipient (no session): the invite token itself authenticates the join
  // (2026-06-12, limited-member friction fix) — show the same approve screen and
  // call the direct-join API on tap. No re-entering the phone number.
  const [directJoin, setDirectJoin] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!token) { setPhase("error"); setError("קישור הזמנה חסר"); return; }
    api.lookupInvite(token)
      .then((result) => {
        setInvite(result.invite);
        setHousehold(result.household);
        return api.me()
          .then((me) => { setCurrentUser(me.user); setDirectJoin(false); setPhase("preview"); })
          .catch(() => { setDirectJoin(true); setPhase("preview"); });
      })
      .catch(() => { setPhase("error"); setError("ההזמנה לא נמצאה או שפגה תוקפה"); });
  }, [token]);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!phone.trim()) return;
    setError(undefined);
    // 2026-06-12 incident: this form used to submit the raw typed string — a
    // local-format phone ("05x…") fails the backend's E.164 schema. Normalize
    // exactly like the login screen so the API only ever sees E.164.
    const e164 = toE164(dialForIso(countryIso), phone);
    if (!e164) {
      setError("מספר הטלפון לא נראה תקין.");
      return;
    }
    try {
      // Pass the join URL as `next` so the magic link redirects back here after auth
      const nextUrl = `/join?token=${encodeURIComponent(token)}`;
      await api.requestMagicLink(e164, nextUrl);
      setPhase("link_sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת הקישור");
    }
  }

  async function join() {
    setPhase("joining");
    setError(undefined);
    try {
      const nameToSend = displayName.trim() || undefined;
      if (directJoin) {
        // The single-use invite token authenticates the invited phone's user; the
        // response sets the session cookie and the api-client stores the csrfToken.
        await api.joinHouseholdDirect(token, nameToSend);
      } else {
        await api.joinHousehold(token, nameToSend);
      }
      setPhase("done");
      setTimeout(() => router.replace("/dashboard"), 1800);
    } catch (err) {
      // Old backend without the direct-join route → fall back to the legacy
      // enter-phone → magic-link loop instead of a dead end.
      if (directJoin && err instanceof ApiClientError && err.status === 404 && err.code === "http.not_found") {
        setPhase("auth");
        return;
      }
      setError(describeJoinError(err));
      setPhase("preview");
    }
  }

  function describeJoinError(err: unknown): string {
    if (err instanceof ApiClientError) {
      if (err.code === "invite.already_consumed") return "ההזמנה הזו כבר נוצלה. בקשו הזמנה חדשה מבעל הבית.";
      if (err.code === "invite.expired" || err.code === "invite.not_found") return "ההזמנה לא נמצאה או שפג תוקפה. בקשו הזמנה חדשה מבעל הבית.";
    }
    return "שגיאה בהצטרפות. נסו שוב.";
  }

  // ── Static states ──────────────────────────────────────────────────────────

  if (phase === "loading") {
    return <div className="login-page"><div className="login-box">טוען...</div></div>;
  }

  if (phase === "error") {
    return (
      <div className="login-page">
        <div className="login-box status error">{error}</div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="login-page">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>✓</div>
          <div style={{ fontWeight: 600 }}>הצטרפת בהצלחה!</div>
          <div className="muted" style={{ marginTop: 4 }}>עובר לדשבורד...</div>
        </div>
      </div>
    );
  }

  // ── Household summary card (shown in all non-terminal phases) ──────────────

  const householdCard = invite && household && (
    <div style={{ background: "var(--surface, #f8f9fa)", borderRadius: 10, padding: "14px 18px", marginBottom: 20, textAlign: "center" }}>
      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{household.name}</div>
      <div className="muted" style={{ marginTop: 4 }}>תפקיד: <strong>{ROLE_LABELS[invite.role] ?? invite.role}</strong></div>
      {invite.personalBudgetMonthly !== undefined && (
        <div className="muted" style={{ marginTop: 2 }}>
          תקציב אישי: {invite.personalBudgetMonthly.toLocaleString()} ₪/חודש
        </div>
      )}
    </div>
  );

  // ── Phase: auth — enter phone to get magic link ────────────────────────────

  if (phase === "auth") {
    return (
      <div className="login-page">
        <section className="login-box">
          <h1 className="page-title">הצטרפות לבית</h1>
          {householdCard}
          <p className="muted" style={{ marginBottom: 14 }}>הזן את מספר הטלפון שלך כדי לקבל קישור כניסה:</p>
          <form className="form" onSubmit={sendMagicLink} noValidate>
            <label className="auth-field-label" htmlFor="join-phone">מספר טלפון</label>
            <PhoneInput
              id="join-phone"
              countryIso={countryIso}
              onCountryChange={(iso) => { setCountryIso(iso); setError(undefined); }}
              phone={phone}
              onPhoneChange={(v) => { setPhone(v); setError(undefined); }}
              invalid={Boolean(error)}
            />
            <button className="button" type="submit" disabled={!phone.trim()}>
              שלח קישור כניסה
            </button>
          </form>
          {error && <div className="status error" style={{ marginTop: 12 }}>{error}</div>}
        </section>
      </div>
    );
  }

  // ── Phase: link_sent — waiting for user to click magic link ───────────────

  if (phase === "link_sent") {
    return (
      <div className="login-page">
        <section className="login-box" style={{ textAlign: "center" }}>
          <h1 className="page-title">בדוק את ה-WhatsApp שלך</h1>
          {householdCard}
          <div style={{ fontSize: "2.5rem", margin: "12px 0" }}>📲</div>
          <p>שלחנו לך קישור כניסה ב-WhatsApp.</p>
          <p className="muted" style={{ marginTop: 6 }}>לחיצה על הקישור תחזיר אותך לכאן אוטומטית.</p>
        </section>
      </div>
    );
  }

  // ── Phase: preview — authenticated, ready to join ─────────────────────────

  if (phase === "preview" || phase === "joining") {
    // The admin pre-set a name in the invite → skip the name input entirely.
    // Otherwise show the name field only if the user has no display name yet.
    const needsName = !currentUser?.displayName && !invite?.invitedName;
    const greetingName = currentUser?.displayName ?? invite?.invitedName;
    return (
      <div className="login-page">
        <section className="login-box">
          <h1 className="page-title">הצטרפות לבית</h1>
          {householdCard}
          {greetingName && (
            <p className="muted" style={{ textAlign: "center", marginBottom: 12 }}>
              שלום {greetingName} 👋
            </p>
          )}
          <div className="form">
            {needsName && (
              <label>
                השם שלך (יוצג לשאר חברי הבית)
                <input
                  className="input"
                  value={displayName}
                  placeholder="שם פרטי"
                  autoComplete="given-name"
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
            )}
            <button
              className="button"
              style={{ width: "100%" }}
              disabled={phase === "joining" || (needsName && !displayName.trim())}
              onClick={join}
            >
              {phase === "joining" ? "מצטרף..." : "הצטרף לבית"}
            </button>
          </div>
          {error && <div className="status error" style={{ marginTop: 12 }}>{error}</div>}
        </section>
      </div>
    );
  }

  return null;
}

// Default export wraps the inner component in Suspense — required by Next.js 15
// whenever useSearchParams() is used during static generation.
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="login-page"><div className="login-box">טוען...</div></div>}>
      <JoinPageInner />
    </Suspense>
  );
}
