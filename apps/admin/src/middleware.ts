/**
 * Admin app guard (app-level auth, 2026-06-24). Runs on every route except NextAuth's own endpoints
 * and Next static assets. Server-side protection for the page shell AND the BFF:
 *   • unauthenticated → page request redirects to /login; /api/* request gets 401 JSON (never a
 *     redirect, so XHR see a clean status). The admin UI shell is NOT public.
 *   • authenticated but the email is no longer allow-listed → treated as unauthenticated (live
 *     allowlist re-check is the revocation lever for the stateless 30-day JWT session).
 *   • authenticated + on /login → bounce to the dashboard.
 *   • authenticated → mint a readable double-submit CSRF cookie (__Host-admin_csrf) if absent, so
 *     the SPA can echo it in X-CSRF-Token and the BFF can verify header===cookie on every non-GET.
 *     Minted on the first matched request (page navigation) so it is present before any mutation.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { isAllowedAdmin } from "./lib/adminAllowlist";

const { auth } = NextAuth(authConfig);
const CSRF_COOKIE = "__Host-admin_csrf";

export default auth((req) => {
  const { nextUrl } = req;
  const email = req.auth?.user?.email;
  const isAuthed = !!email && isAllowedAdmin(email);
  const isApi = nextUrl.pathname.startsWith("/api/");
  const isLogin = nextUrl.pathname === "/login";

  if (!isAuthed) {
    if (isApi) {
      return NextResponse.json(
        { error: { code: "admin.unauthorized", message: "Admin sign-in required" } },
        { status: 401 }
      );
    }
    if (!isLogin) return NextResponse.redirect(new URL("/login", nextUrl));
    return NextResponse.next();
  }

  if (isLogin) return NextResponse.redirect(new URL("/", nextUrl));

  const res = NextResponse.next();
  if (!req.cookies.get(CSRF_COOKIE)) {
    // Double-submit CSRF token. Readable (not HttpOnly) so the SPA echoes it; __Host- + Secure +
    // no Domain defeats subdomain cookie-tossing; SameSite=Lax. Web Crypto only (Edge runtime).
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    res.cookies.set(CSRF_COOKIE, token, { httpOnly: false, secure: true, sameSite: "lax", path: "/" });
  }
  return res;
});

// Protect everything except NextAuth's own routes and Next static assets. The OAuth callback
// (/api/auth/callback/google) MUST be excluded or sign-in wedges.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"]
};
