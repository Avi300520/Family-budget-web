"use client";

import { ApiClientError } from "@shopping-assistant/api-client";

/**
 * Minimal router shape we need — avoids importing Next's internal router type.
 * `useRouter()` from `next/navigation` satisfies this.
 */
interface ReplaceRouter {
  replace: (href: string) => void;
}

/**
 * Sanitize a post-login `next` redirect target to a same-origin RELATIVE path.
 * Returns "/dashboard" for anything unsafe (absent, absolute URL, protocol-relative
 * `//host`, backslash `/\host`, or control characters) so we never introduce an open
 * redirect. Mirrors the backend `sanitizeNextPath` policy (PGS-016).
 */
export function safeNextPath(path: string | null | undefined): string {
  if (!path) return "/dashboard";
  const trimmed = path.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    Array.from(trimmed).some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)
  ) {
    return "/dashboard";
  }
  return trimmed;
}

/**
 * Client-side auth guard. If `err` is a 401 (unauthenticated), redirect to
 * `/login?next=<current path>` and return `true` so the caller can stop rendering
 * (and avoid surfacing the raw backend "Authentication required" message). Any other
 * error returns `false` so the page can show its own (network/5xx) error state.
 *
 * This replaces the invalid PGS-002 middleware cookie gate: the session cookie is
 * HttpOnly + host-only to api.pingtally.com and is not visible to the frontend, so
 * auth must be checked by calling `/me` and reacting to a 401 here.
 */
export function redirectIfUnauthorized(
  err: unknown,
  router: ReplaceRouter,
  pathname: string | null
): boolean {
  if (err instanceof ApiClientError && err.status === 401) {
    router.replace(`/login?next=${encodeURIComponent(safeNextPath(pathname))}`);
    return true;
  }
  return false;
}
