import { NextResponse } from "next/server";

/**
 * PGS-017A — auth gating moved OUT of Next middleware (client-side `/me` guard instead).
 *
 * The previous PGS-002 implementation gated routes by reading the
 * `shopping_assistant_session` cookie on the FRONTEND origin and redirected to
 * `/login` when it was absent. That gate was **invalid** for this architecture:
 * the session cookie is `HttpOnly` and **host-only to `api.pingtally.com`**, so it
 * is never visible to Next middleware running on the frontend origin — neither on a
 * `*.vercel.app` Preview (cross-site) nor on `pingtally.com` (a different host).
 *
 * Consequences of the old gate:
 *  - it redirected `/auth/consume` to `/login` BEFORE the magic-link token could be
 *    consumed (so login never completed), and
 *  - it would have redirect-looped every protected route after a successful consume,
 *    which would have **broken production login** once this branch merged to `main`.
 *
 * Auth is now enforced CLIENT-SIDE via `/me` (see `lib/authGuard.ts` →
 * `redirectIfUnauthorized`, used by protected pages such as the dashboard): the page
 * shows a loading state, calls `/me`, and on a 401 redirects unauthenticated users to
 * `/login?next=<internal-path>` — without surfacing a raw "Authentication required".
 *
 * **PGS-002 (middleware-based redirect) is NOT valid with the current cross-subdomain,
 * HttpOnly cookie design.** A middleware gate would only become valid with a deliberate
 * shared-domain (`Domain=.pingtally.com`) cookie design — explicitly out of scope for
 * this release. This middleware therefore performs NO cookie read and NO auth redirect;
 * it is a documented pass-through kept so nobody re-introduces a frontend-cookie gate.
 */
export function middleware() {
  // Pass-through only. No cookie read, no auth redirect. Auth is enforced client-side
  // (lib/authGuard.ts). Kept (not deleted) so the rationale above lives in-tree and
  // nobody re-introduces a frontend-cookie auth gate here.
  return NextResponse.next();
}

// Same matcher the old gate used (excludes static assets). The handler is now a no-op,
// so this is harmless — it exists only to keep the documented placeholder active.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
