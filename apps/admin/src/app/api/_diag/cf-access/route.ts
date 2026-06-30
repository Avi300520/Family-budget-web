/**
 * TEMPORARY Phase-C diagnostic (2026-06-30). Admin-session-gated by middleware (matcher guards all
 * /api/* except api/auth). Reports whether the Cloudflare Access service-token env vars are present
 * and well-formed in THIS deployment, and runs a server-side probe that hits the backend admin path
 * exactly as the BFF does — to distinguish "credentials reach the backend" from "Cloudflare edge
 * block". Returns ONLY booleans / lengths / statuses — NEVER any secret value. Remove after Phase C.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND = process.env.ADMIN_BACKEND_ORIGIN ?? "https://api.pingtally.com";

export async function GET() {
  const id = process.env.CF_ACCESS_CLIENT_ID ?? "";
  const secret = process.env.CF_ACCESS_CLIENT_SECRET ?? "";
  const svc = process.env.ADMIN_SERVICE_TOKEN ?? "";

  const env = {
    cfClientIdSet: id.length > 0,
    cfClientSecretSet: secret.length > 0,
    cfClientIdEndsWithDotAccess: /\.access$/.test(id.trim()), // CF service-token Client IDs end in ".access"
    cfClientIdLength: id.length,
    cfClientSecretLength: secret.length,
    cfClientIdSurroundingWhitespace: id !== id.trim(),
    cfClientSecretSurroundingWhitespace: secret !== secret.trim(),
    adminServiceTokenSet: svc.length > 0,
    vercelEnv: process.env.VERCEL_ENV ?? null
  };

  // Server-side probe: hit the backend admin path the SAME way the BFF does (Bearer service token +
  // CF-Access service-token headers). A deliberately NON-allow-listed X-Admin-Email is used, so a
  // successful CF pass returns a backend 401/403 JSON error (NOT 200) and fetches no real admin data.
  //   reachedBackend=true  -> the request passed the Cloudflare edge and Node answered (credentials OK
  //                           for the gate; with the gate OFF this just proves the BFF->backend path)
  //   cfAccessBlocked=true  -> Cloudflare Access blocked it at the edge (missing/invalid CF credentials
  //                           or the service token is not in the Access policy)
  let probe: Record<string, unknown> = { ran: false };
  try {
    const headers: Record<string, string> = {
      authorization: `Bearer ${svc}`,
      "x-admin-email": "diag-probe@pingtally.invalid"
    };
    const sentCfHeaders = Boolean(id && secret);
    if (sentCfHeaders) {
      headers["cf-access-client-id"] = id;
      headers["cf-access-client-secret"] = secret;
    }
    const res = await fetch(`${BACKEND}/api/v1/admin/overview/counts`, { method: "GET", headers, redirect: "manual" });
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const cfAud = res.headers.get("cf-access-aud");
    const bodyHead = (await res.text()).slice(0, 240).toLowerCase();
    const cfAccessBlocked = Boolean(cfAud) || bodyHead.includes("cloudflareaccess") || bodyHead.includes("<!doctype");
    const reachedBackend = ct.includes("application/json") && bodyHead.includes("\"error\"");
    probe = {
      ran: true,
      sentCfHeaders,
      status: res.status,
      contentTypeIsJson: ct.includes("application/json"),
      reachedBackend,
      cfAccessBlocked
      // body itself is NOT returned (it is a backend error JSON or a CF block page — neither is logged here)
    };
  } catch {
    probe = { ran: true, error: "probe-fetch-failed" };
  }

  return NextResponse.json({ diag: "cf-access", env, probe });
}
