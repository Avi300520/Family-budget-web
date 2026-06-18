"use client";

import { ApiClientError } from "@shopping-assistant/api-client";
import { safeNextPath } from "./authRouting";

// Re-exported so existing imports (`import { safeNextPath } from ".../authGuard"`)
// keep working; the implementation now lives in the dependency-free authRouting.ts
// (alongside routeAfterConsume / requiresOnboarding) so it can be unit-tested.
export { safeNextPath };

// NOTE: there is intentionally NO Next.js middleware auth gate. The session cookie is
// HttpOnly + host-only to api.pingtally.com, so it is invisible to middleware on the
// frontend origin — a middleware redirect would break login (it would bounce
// /auth/consume to /login before the token is consumed). Auth is enforced CLIENT-SIDE
// here via /me (redirectIfUnauthorized). Do NOT re-introduce a frontend-cookie gate
// unless the cookie is redesigned as Domain=.pingtally.com (out of scope).

/**
 * Minimal router shape we need — avoids importing Next's internal router type.
 * `useRouter()` from `next/navigation` satisfies this.
 */
interface ReplaceRouter {
  replace: (href: string) => void;
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
