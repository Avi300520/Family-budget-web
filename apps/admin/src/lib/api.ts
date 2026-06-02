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
