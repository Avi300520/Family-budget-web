"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { redirectIfAuthed } from "../../lib/authRouting";

/**
 * P1 entry-page session probe (WP-P1-FE). Mounted on the marketing "/" and "/login" pages:
 * probes `/me` on mount and, if a valid session already exists, sends the visitor into the
 * app (/dashboard) instead of re-showing the magic-link form — the P1 "authenticated but
 * re-prompted at the root" symptom. Renders nothing: the marketing HTML underneath still
 * SSRs for crawlers and logged-out visitors, and the redirect is client-only after mount.
 * A 401 or a network failure is swallowed (the visitor simply stays on the marketing page).
 */
export function SessionRedirect() {
  const router = useRouter();
  useEffect(() => {
    // PERF-002: only probe /me when a client-side session hint exists. A logged-in
    // session always leaves a csrfToken in localStorage (the api client stores it);
    // a fresh anonymous visitor has none, so we skip the request entirely. That
    // removes the GET /v1/me → 401 the browser logs to the console on every public
    // landing hit, and drops one request from the critical render path. Returning
    // visitors with a live session still have the token, so they're still sent in.
    //
    // Known limitation — accepted, not a bug (WP-CQ-06): a visitor whose session
    // cookie is still valid but whose localStorage was cleared independently (partial
    // browser-data clear, some private-mode restore paths) is NOT auto-redirected —
    // they land on the marketing/login page instead of /dashboard. Accepted on
    // purpose: the session cookie is HttpOnly, so the only way to detect that state is
    // the /me probe this gate removed, and it would have to fire for EVERY anonymous
    // visitor (they're indistinguishable client-side without it), reintroducing exactly
    // the per-visit request + console 401 PERF-002 removed — a net loss to serve a rare
    // case. It is non-breaking (the session is not lost; the visitor still reaches the
    // app via the magic-link login) and self-heals on the next explicit login, which
    // re-populates csrfToken. See MASTER_REMEDIATION_PLAN "Known limitations".
    if (typeof window !== "undefined" && !window.localStorage.getItem("csrfToken")) return;
    let cancelled = false;
    void redirectIfAuthed(
      () => api.me(),
      (href) => { if (!cancelled) router.replace(href); }
    );
    return () => { cancelled = true; };
  }, [router]);
  return null;
}
