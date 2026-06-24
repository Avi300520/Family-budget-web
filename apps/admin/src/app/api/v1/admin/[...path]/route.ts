/**
 * Same-origin admin BFF proxy (app-level auth, 2026-06-24 — replaces the Cloudflare Access flow).
 *
 * The admin SPA calls its OWN origin (admin.pingtally.com/api/v1/admin/*); the browser never makes a
 * cross-origin XHR to api.pingtally.com. This server-side route:
 *   1. validates the NextAuth (Google) app session + re-checks the live admin allowlist (401 if not);
 *   2. answers /auth/me locally from the session (no backend call, no token) so identity renders even
 *      if the backend is briefly unreachable;
 *   3. on any non-GET, enforces CSRF — strict same-origin (Origin + Sec-Fetch-Site, fail-closed) AND
 *      a double-submit token (X-CSRF-Token header === __Host-admin_csrf cookie, constant-time);
 *   4. forwards server-side to the backend with `Authorization: Bearer $ADMIN_SERVICE_TOKEN`
 *      (server-only, never in the browser) + `X-Admin-Email` derived ONLY from the validated session.
 *
 * The service token and the admin email are set fresh server-side, so a client-supplied Authorization
 * or X-Admin-Email header is never forwarded. Not an open proxy: GET/POST only, fixed /api/v1/admin/
 * prefix, traversal-guarded. The Cloudflare-Access JWT forwarding is gone; the /h360 alias is kept
 * (harmless) until the post-cutover cleanup so the shared api-client paths are unchanged.
 */
import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { auth } from "../../../../../auth";
import { isAllowedAdmin } from "../../../../../lib/adminAllowlist";
import { mapAdminAliasPath } from "../../../../../lib/adminAlias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_ORIGIN = process.env.ADMIN_BACKEND_ORIGIN ?? "https://api.pingtally.com";
const CSRF_COOKIE = "__Host-admin_csrf";

function err(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function unsafeSegment(seg: string): boolean {
  return seg === "" || seg === "." || seg === ".." || seg.includes("/") || seg.includes("\\");
}

/** Constant-time compare of two strings (length-safe via sha256). */
function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

async function proxy(req: NextRequest, segments: string[]): Promise<Response> {
  // 1. App session + LIVE allowlist (re-checked every request → instant revocation despite the
  //    stateless 30-day JWT).
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email || !isAllowedAdmin(email)) {
    return err("admin.unauthorized", "Admin sign-in required", 401);
  }

  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "POST") return err("admin.method_not_allowed", "Method not allowed", 405);
  if (!segments.length || segments.some(unsafeSegment)) return err("admin.bad_path", "Invalid admin path", 400);

  // 2. Identity is sourced from the app session — answer /auth/me without a backend round-trip.
  if (segments.length === 2 && segments[0] === "auth" && segments[1] === "me") {
    return Response.json({ adminEmail: email, via: "app-session" });
  }

  // 3. CSRF on every non-GET: same-origin (primary, fail-closed) + double-submit token (defense in
  //    depth). A distinct code (admin.csrf_invalid, NOT auth.csrf_invalid) so the api-client's
  //    auth.csrf_invalid self-heal retry is never triggered here.
  if (method !== "GET") {
    const origin = req.headers.get("origin");
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (!origin || origin !== req.nextUrl.origin) return err("admin.csrf_origin", "Cross-origin admin request refused", 403);
    if (secFetchSite && secFetchSite !== "same-origin") return err("admin.csrf_origin", "Cross-site admin request refused", 403);
    const headerToken = req.headers.get("x-csrf-token") ?? "";
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value ?? "";
    if (!constantTimeEqual(headerToken, cookieToken)) {
      return err("admin.csrf_invalid", "Admin CSRF token is missing or invalid", 403);
    }
  }

  // 4. Server-only service token — fail closed if not configured (never silently send no auth).
  const serviceToken = process.env.ADMIN_SERVICE_TOKEN;
  if (!serviceToken) return err("admin.proxy_not_configured", "Admin API authentication is not configured", 503);

  // Map the browser-facing /h360/* alias back to the real backend /households/* path. The traversal
  // guard above runs on the RAW browser segments; mapAdminAliasPath only substitutes known literals.
  const segs = mapAdminAliasPath(segments);
  const target = `${BACKEND_ORIGIN}/api/v1/admin/${segs.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  // Headers built fresh server-side: a client cannot inject Authorization or X-Admin-Email.
  const headers: Record<string, string> = {
    authorization: `Bearer ${serviceToken}`,
    "x-admin-email": email
  };
  let body: string | undefined;
  if (method === "POST") {
    body = await req.text();
    headers["content-type"] = req.headers.get("content-type") ?? "application/json";
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(target, { method, headers, body, redirect: "manual" });
  } catch {
    return err("admin.proxy_unreachable", "Could not reach the admin API", 502);
  }

  // A 3xx from the backend would mean an unexpected edge challenge — surface a clear error rather
  // than leak a cross-origin redirect to the browser.
  if (backendRes.status >= 300 && backendRes.status < 400) {
    return err("admin.proxy_redirect", "The admin API returned an unexpected redirect", 502);
  }

  const text = await backendRes.text();
  return new Response(text, {
    status: backendRes.status,
    headers: { "content-type": backendRes.headers.get("content-type") ?? "application/json" }
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
