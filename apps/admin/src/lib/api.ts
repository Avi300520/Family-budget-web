"use client";

import { createApiClient } from "@shopping-assistant/api-client";

// SAME-ORIGIN by design. The admin UI calls admin.pingtally.com/api/v1/admin/* (baseUrl ""), which
// a same-origin Next.js route handler (src/app/api/v1/admin/[...path]/route.ts) proxies server-side
// to the backend, forwarding the Cloudflare-verified Access identity. This avoids a cross-origin XHR
// to api.pingtally.com — that XHR is challenged by Cloudflare Access (302 → login) and then blocked
// by the browser as a CORS error, even with credentials:"include" and a valid Access session.
// The browser only ever talks to its own origin (first-party Access cookie) and stores NO token/secret.
export const api = createApiClient({ baseUrl: "" });

/** True for an auth/authorization failure (re-authenticate through Cloudflare Access). */
export function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403;
}

export const ACCESS_DENIED_MESSAGE =
  "Access denied or session expired. Re-authenticate through Cloudflare Access.";

/**
 * Map any thrown admin-API error to a safe, actionable message.
 * - 401/403 → re-authenticate through Cloudflare Access.
 * - other HTTP status → show the status/code (never the raw payload).
 * - no status (a `TypeError: Failed to fetch`) → a network/CORS failure reaching the API.
 */
export function toErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) return ACCESS_DENIED_MESSAGE;
  if (typeof status === "number") {
    const code = (err as { code?: string })?.code;
    return `Request failed (${status}${code ? ` · ${code}` : ""}).`;
  }
  return "Could not reach the admin API (network/CORS). Confirm you're signed in through Cloudflare Access, then retry.";
}
