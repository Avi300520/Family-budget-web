"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiClientError } from "@shopping-assistant/api-client";
import { api } from "../../../lib/api";
import { safeNextPath } from "../../../lib/authGuard";

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
      const next = params.get("next");
      if (next) {
        router.replace(safeNextPath(next));
        return;
      }
      router.replace(result.hasHousehold ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(describeConsumeError(err));
      setWorking(false);
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-box status error">חסר token. בקשו קישור חדש מעמוד הכניסה.</div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>כמעט בפנים 👋</div>
        <div className="muted">לחצו כדי להיכנס לקופה המשפחתית.</div>
        <button className="button" onClick={confirmLogin} disabled={working} style={{ minWidth: 160 }}>
          {working ? "מתחברים..." : "כניסה"}
        </button>
        {error && <div className="status error">{error}</div>}
        {error && (
          <a href="/login" className="muted" style={{ fontSize: "0.9rem" }}>
            לעמוד הכניסה
          </a>
        )}
      </div>
    </div>
  );
}
