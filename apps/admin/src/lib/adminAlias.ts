/**
 * Browser-facing alias for the admin Household-360 API surface.
 *
 * Cloudflare Access 302s requests to the literal `/api/v1/admin/households*` path at the
 * admin.pingtally.com edge — proven 2026-06-23: the bare-path admin siblings (integrity,
 * overview/counts, auth/me) reach Vercel with 200, but `/api/v1/admin/households/search`
 * never reaches Vercel OR the backend (backend audit shows `admin.integrity.viewed` rows
 * but zero `admin.household.searched`). The browser `fetch` follows that cross-origin 302
 * to the Access login and the browser blocks it as a CORS error — the reported failure.
 * (Method/query string are NOT the cause: a query-GET and a no-query-POST both failed, the
 * bare GETs succeed; the prior "WAF blocks the query string" diagnosis was wrong.)
 *
 * So the SPA calls `/api/v1/admin/h360/*` — a prefix with no "households"/"search" token,
 * which the edge does not challenge — and this same-origin BFF maps it back to the real,
 * UNCHANGED backend path here, server-side, where the edge rule does not apply. Auth is
 * unchanged: the request is still same-origin behind Cloudflare Access; the verified
 * Cf-Access-Jwt-Assertion is still forwarded and re-verified by the backend.
 *
 *   h360/find                                       -> households/search   (POST, body params)
 *   h360/<id>                                       -> households/<id>
 *   h360/<id>/billing|audit|notes|reveal|grant|...  -> households/<id>/...
 */
export function mapAdminAliasPath(segments: string[]): string[] {
  if (segments[0] !== "h360") return segments;
  const mapped = ["households", ...segments.slice(1)];
  // The search endpoint has no :id, so its alias is the bare `h360/find`. Household ids are
  // UUIDs and never equal "find", so this only ever rewrites the search alias.
  if (mapped.length === 2 && mapped[1] === "find") mapped[1] = "search";
  return mapped;
}
