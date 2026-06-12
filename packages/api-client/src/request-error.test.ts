import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "./index";

/**
 * Regression for the admin "Could not reach the admin API (network/CORS)" misdiagnosis.
 *
 * The bug: request() ran `JSON.parse(text)` BEFORE checking response.ok, so any non-JSON body
 * (an HTML edge/error page, a proxy 5xx, a Cloudflare interstitial) threw a status-LESS
 * SyntaxError. toErrorMessage() then saw no numeric status and showed the misleading
 * "network/CORS" banner — hiding the REAL HTTP status and making a backend/edge failure look
 * like a Cloudflare Access problem. The fix parses defensively and always surfaces response.status.
 */
function stubFetch(status: number, body: string, contentType: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })));
}

describe("api-client request() surfaces the real HTTP status (no status-less network/CORS error)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a non-JSON error body throws ApiClientError carrying the numeric status (not a SyntaxError)", async () => {
    stubFetch(500, "<html><body>Internal Server Error</body></html>", "text/html");
    const client = createApiClient({ baseUrl: "" });
    const err = await client.request("/api/v1/admin/users/search?by=phone&q=x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).not.toBeInstanceOf(SyntaxError);
    expect((err as ApiClientError).status).toBe(500);
  });

  it("a JSON error body still carries code + status (401 → toErrorMessage shows re-auth)", async () => {
    stubFetch(401, JSON.stringify({ error: { code: "admin.access_required", message: "x" } }), "application/json");
    const client = createApiClient({ baseUrl: "" });
    const err = await client.request("/api/v1/admin/overview").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(401);
    expect((err as ApiClientError).code).toBe("admin.access_required");
  });

  it("an empty non-ok body throws with the status (no parse attempt, no SyntaxError)", async () => {
    stubFetch(502, "", "text/plain");
    const client = createApiClient({ baseUrl: "" });
    const err = await client.request("/api/v1/admin/users/search").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(502);
  });

  it("a valid 2xx JSON response resolves to the parsed body", async () => {
    stubFetch(200, JSON.stringify({ users: [] }), "application/json");
    const client = createApiClient({ baseUrl: "" });
    await expect(client.request<{ users: unknown[] }>("/api/v1/admin/users/search")).resolves.toEqual({ users: [] });
  });
});
