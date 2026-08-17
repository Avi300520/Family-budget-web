// Honest Hebrew error copy (2026-06-12 invite-403 incident): an auth/session failure
// must never be reported as "check the phone number". The api-client already self-heals
// a stale CSRF once via /me — if the failure still reaches here, the session itself
// needs a fresh login.
//
// Beyond those two, prefer the API's OWN message over a hardcoded generic string: the
// server knows why it refused (a number already tied to another household, a plan limit)
// and it owns that copy, so duplicating it here would just create two places to drift.
//
// Import-free at runtime (duck-typed on the ApiClientError { code, status, message }
// shape, same reason as billingCheckoutError.ts: ApiClientError's constructor uses a TS
// parameter property, which `node --experimental-strip-types` cannot load) so it stays
// unit-testable with `node --test`. `import type` is erased, so the pin below costs
// nothing at runtime.

import type { ApiClientError } from "@shopping-assistant/api-client";

/** Compile-time pin for the duck-type below. If ApiClientError ever stops exposing
 *  `code`/`status`/`message` publicly, tsc fails HERE — otherwise the guard would
 *  silently stop matching at runtime, every branch would degrade to the fallback, and
 *  no test could catch it, because this test runner cannot load the class at all. */
type _ApiClientErrorShapePin = ApiClientError extends { code: string; status: number; message: string }
  ? true
  : never;
export type { _ApiClientErrorShapePin };

/** Only the API's own user-facing Hebrew may be shown verbatim. `api-client` falls back to
 *  `Request failed with status ${n}` for a non-JSON body (nginx 502, gateway timeout), and
 *  several DomainErrors carry internal English ("Invalid request body", "Unexpected error",
 *  "User is not a household member"). None of that may reach a screen — CLAUDE.md §4: never
 *  expose raw error codes or stack traces, translate failures to actionable Hebrew.
 *  Presentability is the property we actually want, so test for it directly; anything
 *  without a Hebrew letter falls back. */
function containsHebrew(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0590 && c <= 0x05ff) return true;
  }
  return false;
}

function isApiClientErrorShape(err: unknown): err is { code?: string; status?: number; message?: string } {
  return typeof err === "object" && err !== null && "code" in err && "status" in err;
}

export function describeMemberActionError(err: unknown, fallback: string): string {
  if (isApiClientErrorShape(err)) {
    if (err.code === "auth.csrf_invalid" || err.code === "auth.unauthorized" || err.status === 401) {
      return "החיבור לחשבון פג. רעננו את הדף ונסו שוב - ואם זה חוזר, התחברו מחדש.";
    }
    if (err.code === "auth.forbidden") {
      return "רק בעלים או מנהל יכולים לבצע את הפעולה הזו.";
    }
    if (err.message && containsHebrew(err.message)) return err.message;
  }
  return fallback;
}
