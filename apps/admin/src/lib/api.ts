"use client";

import { createApiClient } from "@shopping-assistant/api-client";
import { apiBaseUrl } from "./apiBase";

// Admin identity is established entirely by Cloudflare Access: the browser carries the signed
// Access session on credentialed requests (`credentials: "include"` inside createApiClient) and
// the backend verifies the `Cf-Access-Jwt-Assertion`. The browser stores NO admin token or
// secret — there is no token login and nothing in localStorage/sessionStorage.
export const api = createApiClient({ baseUrl: apiBaseUrl() });

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
