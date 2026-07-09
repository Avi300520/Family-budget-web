/**
 * Pure, dependency-free auth routing decisions.
 *
 * These functions hold the post-authentication navigation policy with NO React,
 * Next, or api-client imports, so they can be unit-tested in isolation (see
 * authRouting.test.ts, run with `node --test`). The React-coupled guard
 * (`redirectIfUnauthorized`) and its consumers live in `authGuard.ts`, which
 * re-exports `safeNextPath` from here so existing imports keep working.
 */

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
 * Where to send a user immediately after a successful magic-link consume.
 *
 * 2026-06-14 incident: a brand-new user with no household used to be routed to
 * `/dashboard` whenever the magic link carried a `next` (the site root `/`
 * redirects to `/dashboard`, so an unauthenticated first visit bakes
 * `next=/dashboard` into the login link). The dashboard has nothing to render
 * for a household-less user and would hang on the loading state forever. We now
 * force onboarding FIRST when there is no household, regardless of `next`; only
 * a user who already has a household honors `next` (falling back to /dashboard).
 */
export function routeAfterConsume(hasHousehold: boolean, next: string | null | undefined): string {
  if (!hasHousehold) return "/onboarding";
  return next ? safeNextPath(next) : "/dashboard";
}

/**
 * Whether an authenticated user must complete onboarding before any
 * household-scoped screen (e.g. the dashboard) can render. True when `/me`
 * returned a user but no household (no membership yet).
 */
export function requiresOnboarding(household: unknown): boolean {
  return !household;
}

/**
 * Entry-page session probe (WP-P1-FE / P1). The marketing "/" and "/login" pages check
 * `/me` on mount; if a valid session already exists, send the visitor into the app instead
 * of re-showing the magic-link form (the P1 "authenticated at /dashboard but re-prompted at
 * the root" symptom). Any failure (401 / network) is swallowed — an unauthenticated visitor
 * just stays on the marketing page. Pure orchestration (takes the probe + navigator as args)
 * so it is unit-testable with no React / api-client import. Returns whether it redirected.
 */
export async function redirectIfAuthed(
  probe: () => Promise<unknown>,
  replace: (href: string) => void,
  dashboard = "/dashboard"
): Promise<boolean> {
  try {
    await probe();
    replace(dashboard);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bootstrap error policy for the onboarding wizard (WP-P1-FE / NF-M17). The wizard resolves
 * the user via `/me` on mount. A genuine 401 means "not logged in" → go to /login. But a
 * TRANSIENT network failure (fetch throws a TypeError with no `status`) or a 5xx must NOT
 * bounce the user to login — that discards their authenticated context on a blip. We
 * duck-type the ApiClientError shape (`status === 401`) so this stays import-free.
 */
export function bootstrapErrorAction(err: unknown): "login" | "retry" {
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  return status === 401 ? "login" : "retry";
}
