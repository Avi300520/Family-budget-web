"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiClientError } from "@shopping-assistant/api-client";
import { api } from "../../../lib/api";
import { routeAfterConsume } from "../../../lib/authRouting";

/**
 * Magic-link landing page — interstitial by design (2026-06-12 incident).
 *
 * This page used to consume the one-time token automatically on mount. Meta's
 * link-preview crawler (facebookexternalhit / the WhatsApp preview fetcher)
 * RENDERS this page including its JS, so the auto-consume burned real login
 * links and even created a crawler-held session. Consumption now requires an
 * explicit user tap, and the API additionally refuses known crawler
 * user-agents. Do not reintroduce consume-on-mount here.
 */
export default function ConsumeClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);

  const token = params.get("token");

  function describeConsumeError(err: unknown): string {
    if (err instanceof ApiClientError) {
      if (err.code === "auth.magic_link_consumed") return "הקישור הזה כבר נוצל. אפשר לבקש קישור חדש מעמוד הכניסה.";
      if (err.code === "auth.magic_link_expired") return "תוקף הקישור פג. אפשר לבקש קישור חדש מעמוד הכניסה.";
      if (err.code === "auth.invalid_magic_link") return "הקישור לא תקין. אפשר לבקש קישור חדש מעמוד הכניסה.";
    }
    return "משהו השתבש בכניסה. נסו שוב, או בקשו קישור חדש מעמוד הכניסה.";
  }

  async function confirmLogin() {
    if (!token || working) return;
    setWorking(true);
    setError(undefined);
    try {
      const result = await api.consumeMagicLink(token);
      // A user with no household must onboard FIRST — even if the link carried a
      // `next` (e.g. `next=/dashboard` baked in by the root redirect). Only a user
      // who already has a household honors `next` (else falls back to /dashboard).
      // (2026-06-14 incident — see lib/authRouting.ts.)
      router.replace(routeAfterConsume(result.hasHousehold, params.get("next")));
    } catch (err) {
      setError(describeConsumeError(err));
      setWorking(false);
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <main id="main" className="login-box status error">
          <h1 className="sr-only">כניסה</h1>
          <div role="alert">חסר token. בקשו קישור חדש מעמוד הכניסה.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="login-page">
      <main id="main" className="login-box" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
        {/* h1 carries the original inline style + margin:0 so the rendered pixels
            are unchanged (a styled <div> was the only page title before). */}
        <h1 style={{ fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>כמעט בפנים <span aria-hidden>👋</span></h1>
        <div className="muted">לחצו כדי להיכנס לקופה המשפחתית.</div>
        <button className="button" type="button" onClick={confirmLogin} disabled={working} style={{ minWidth: 160 }}>
          {working ? "מתחברים..." : "כניסה"}
        </button>
        {/* Disabling the button on submit drops focus, so the label change alone
            is never announced - this persistent live region carries the state. */}
        <span className="sr-only" role="status">{working ? "מתחברים..." : ""}</span>
        {error && <div className="status error" role="alert">{error}</div>}
        {error && (
          <a href="/login" className="muted" style={{ fontSize: "0.9rem" }}>
            לעמוד הכניסה
          </a>
        )}
      </main>
    </div>
  );
}
