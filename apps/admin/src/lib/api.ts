"use client";

import { createApiClient } from "@shopping-assistant/api-client";

/** Read a non-HttpOnly cookie by name (SSR-safe: returns undefined when document is unavailable). */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split("; ")) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}

// SAME-ORIGIN by design. The admin UI calls admin.pingtally.com/api/v1/admin/* (baseUrl ""), which a
// same-origin Next.js route handler (src/app/api/v1/admin/[...path]/route.ts) proxies server-side to
// the backend, attaching the server-only admin service token + the validated session email. The
// browser only ever talks to its own origin and stores NO token/secret. On every non-GET, the
// api-client echoes the readable double-submit CSRF cookie (__Host-admin_csrf, minted by middleware)
// as X-CSRF-Token; the BFF verifies header === cookie.
export const api = createApiClient({ baseUrl: "", getCsrfToken: () => readCookie("__Host-admin_csrf") });

/** True for an auth/authorization failure (re-authenticate through Cloudflare Access). */
export function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403;
}

/**
 * A *transport* failure: the browser→same-origin-BFF `fetch()` itself threw, so the
 * error carries NO HTTP status. In this same-origin admin app that almost always means
 * Cloudflare Access challenged the XHR (302 → cloudflareaccess.com, which the browser
 * then blocks as a cross-origin/CORS error) because the first-party `CF_Authorization`
 * cookie was not presented on the request — e.g. the Access session expired, or a
 * private/Incognito window is blocking the cookie. A full-page reload re-runs Access via
 * a top-level navigation (which CAN complete the redirect) and re-primes the cookie, so
 * the UI offers a "reload to re-authenticate" affordance for this case.
 *
 * NOTE: any real HTTP error — including the BFF's own 401 `admin.access_required`, 502
 * `admin.access_proxy_challenged`, 502 `admin.proxy_unreachable`, or a backend 4xx/5xx —
 * DOES carry a status and is reported honestly with its status/code below; it is NOT
 * collapsed into the generic transport message.
 */
export function isTransportError(err: unknown): boolean {
  return typeof (err as { status?: number })?.status !== "number";
}

export const ACCESS_DENIED_MESSAGE =
  "Access denied or your admin session expired. Sign in again to continue.";

/**
 * Map any thrown admin-API error to a safe, actionable message that always reflects the
 * REAL failure (status + code + optional action context), masked and without payloads.
 * - 401/403 → re-authenticate through Cloudflare Access.
 * - other HTTP status → show the status/code so the real backend/BFF error is visible.
 * - no status (transport / Access-challenged XHR) → say so honestly and tell the user to
 *   reload to re-authenticate — never the old misleading "network/CORS" that hid the cause.
 * @param context optional short action label, e.g. "user search", surfaced in the message.
 */
export function toErrorMessage(err: unknown, context?: string): string {
  const where = context ? ` while loading ${context}` : "";
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) return ACCESS_DENIED_MESSAGE;
  if (typeof status === "number") {
    const code = (err as { code?: string })?.code;
    return `Request failed${where} (${status}${code ? ` · ${code}` : ""}).`;
  }
  return `Could not reach the admin API${where} — no response (the request was blocked before any HTTP status). Your admin session may have expired; reload the page to sign in again.`;
}
