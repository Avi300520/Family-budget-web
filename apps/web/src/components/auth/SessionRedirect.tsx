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
    let cancelled = false;
    void redirectIfAuthed(
      () => api.me(),
      (href) => { if (!cancelled) router.replace(href); }
    );
    return () => { cancelled = true; };
  }, [router]);
  return null;
}
