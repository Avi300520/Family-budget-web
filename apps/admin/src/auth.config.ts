/**
 * Edge-safe NextAuth (Auth.js v5) base config for the admin app (app-level auth, 2026-06-24).
 *
 * Kept free of Node-only deps so it can be imported by BOTH the Node auth handler (auth.ts) and the
 * Edge middleware (middleware.ts). Identity = Google OAuth; the server-only admin allowlist
 * (ADMIN_ALLOWED_EMAILS) is enforced in the signIn callback — the ONLY accounts that can obtain a
 * session. Sessions are stateless JWTs (30-day rolling) so removing an email from the allowlist is
 * the revocation lever: the BFF + middleware re-check isAllowedAdmin live on every request.
 */
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedAdmin, recordAdminAuthEvent } from "./lib/adminAllowlist";

export const authConfig: NextAuthConfig = {
  providers: [Google],
  // 30-day rolling session ("remember this device"): NextAuth refreshes the cookie on activity, so
  // a daily-active admin's window slides. Re-auth is needed only on logout, expiry, cookie deletion,
  // allowlist removal (re-checked live), or secret rotation. HttpOnly + Secure + SameSite=Lax come
  // from the v5 defaults (__Secure-authjs.session-token in production).
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      const email = user?.email?.trim().toLowerCase();
      if (!email || !isAllowedAdmin(email)) {
        if (email) await recordAdminAuthEvent("login_denied", email);
        return false; // → redirected to /login?error=AccessDenied
      }
      return true;
    }
  },
  events: {
    async signIn({ user }) {
      const email = user?.email?.trim().toLowerCase();
      if (email) await recordAdminAuthEvent("login", email);
    },
    async signOut(message) {
      // jwt session strategy → signOut always carries { token }, never { session }.
      const email = "token" in message ? message.token?.email : undefined;
      if (typeof email === "string") await recordAdminAuthEvent("logout", email.trim().toLowerCase());
    }
  }
};
