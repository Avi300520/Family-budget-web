/**
 * Server-only admin allowlist + auth-audit helper for the admin app's app-level auth (2026-06-24).
 *
 * ADMIN_ALLOWED_EMAILS and ADMIN_SERVICE_TOKEN are SERVER-ONLY env (never NEXT_PUBLIC_*). Next.js
 * does not inline non-NEXT_PUBLIC env into the client bundle, and the post-build bundle check (see
 * the verify step / README) asserts neither string ever ships to the browser. This module is
 * imported ONLY from server modules — auth.config.ts (Node + Edge), middleware.ts (Edge), and the
 * admin BFF route (Node) — and never from a "use client" file. (No `server-only` import because the
 * Edge middleware transitively pulls this in; the no-inline guarantee + bundle check cover the leak.)
 *
 * isAllowedAdmin uses the SAME normalization as the backend isAdminEmailAllowed (trim + lowercase,
 * empty allowlist denies all) so the two allowlists — FE ADMIN_ALLOWED_EMAILS and backend
 * ADMIN_ACCESS_EMAIL_ALLOWLIST — agree on membership and never strand an admin.
 */

/** Case-insensitive exact-match against ADMIN_ALLOWED_EMAILS. Empty/unset allowlist → deny all. */
export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 && list.includes(email.trim().toLowerCase());
}

/**
 * Record an admin auth event in the backend audit log (the trail Cloudflare Access provided at the
 * edge). Authenticated server-to-server by the admin service token. Best-effort: a failure here
 * MUST never block or fail the sign-in / sign-out flow. No-op when the service token is unset (dark).
 */
export async function recordAdminAuthEvent(
  action: "login" | "logout" | "login_denied",
  email: string
): Promise<void> {
  const token = process.env.ADMIN_SERVICE_TOKEN;
  if (!token) return;
  const origin = process.env.ADMIN_BACKEND_ORIGIN ?? "https://api.pingtally.com";
  try {
    await fetch(`${origin}/api/v1/admin/auth/event`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, email })
    });
  } catch {
    // best-effort audit write — never fail or block sign-in/out on it
  }
}
