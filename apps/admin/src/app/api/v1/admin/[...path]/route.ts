/**
 * Same-origin admin BFF proxy.
 *
 * The admin SPA calls its OWN origin — admin.pingtally.com/api/v1/admin/* — so the browser never
 * makes a cross-origin XHR to api.pingtally.com (which Cloudflare Access challenges with a 302 the
 * browser then blocks by CORS). admin.pingtally.com is itself Cloudflare-Access-protected, so this
 * route only ever runs for an authenticated admin, and Cloudflare injects the verified
 * `Cf-Access-Jwt-Assertion` header on the request reaching this server route.
 *
 * This route forwards the request server-side to the backend at api.pingtally.com/api/v1/admin/*,
 * passing the verified assertion both as the header (which the backend verifies — JWT verification
 * is preserved, identity = the real human admin email for audit) and as the CF_Authorization cookie
 * (so the same-Access-app session is accepted at the api.pingtally.com edge). The assertion is only
 * ever handled server-side; it is never exposed to the browser.
 *
 * Not an open proxy: it forwards ONLY to the fixed /api/v1/admin/ prefix, GET/POST only, with
 * path segments validated against traversal. No secrets are read from or returned to the browser.
 */
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_ORIGIN = process.env.ADMIN_BACKEND_ORIGIN ?? "https://api.pingtally.com";

function err(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function unsafeSegment(seg: string): boolean {
  return seg === "" || seg === "." || seg === ".." || seg.includes("/") || seg.includes("\\");
}

async function proxy(req: NextRequest, segments: string[]): Promise<Response> {
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "POST") return err("admin.method_not_allowed", "Method not allowed", 405);
  if (!segments.length || segments.some(unsafeSegment)) return err("admin.bad_path", "Invalid admin path", 400);

  // Cloudflare Access injects this on requests to admin.pingtally.com; a client cannot forge it
  // (Cloudflare overwrites any client-supplied value), and the backend re-verifies it.
  const assertion = req.headers.get("cf-access-jwt-assertion");
  if (!assertion) return err("admin.access_required", "Cloudflare Access authentication required", 401);

  const target = `${BACKEND_ORIGIN}/api/v1/admin/${segments.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {
    "cf-access-jwt-assertion": assertion,
    cookie: `CF_Authorization=${assertion}`
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

  // A 3xx means Cloudflare Access challenged the forwarded session at the api.pingtally.com edge —
  // surface a clear error instead of leaking a cross-origin redirect to the browser.
  if (backendRes.status >= 300 && backendRes.status < 400) {
    return err("admin.access_proxy_challenged", "The admin API rejected the forwarded Access session", 502);
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
