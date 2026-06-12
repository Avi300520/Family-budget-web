import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "./index";

// ──────────────────────────────────────────────────────────────────────────────
// 2026-06-12 invite-403 incident: the HttpOnly session cookie outlives
// localStorage.csrfToken, so a logged-in browser can fail every mutation with
// `auth.csrf_invalid`. The client self-heal: on that exact failure, refresh the
// session once via GET /me (the server rotates and returns a fresh csrfToken)
// and retry the original request exactly ONCE. Never more than once, never for
// other failures, and a failed refresh surfaces the ORIGINAL error.
// ──────────────────────────────────────────────────────────────────────────────

const CSRF_403 = JSON.stringify({ error: { code: "auth.csrf_invalid", message: "CSRF token is missing or invalid" } });
const ME_OK = JSON.stringify({ user: { id: "u1" }, csrfToken: "fresh-token" });

type Call = { url: string; method: string; csrfHeader: string | null };

function stubFetchSequence(responses: Array<{ status: number; body: string }>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), method: (init?.method ?? "GET").toUpperCase(), csrfHeader: headers.get("X-CSRF-Token") });
      const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
      return new Response(next.body, { status: next.status, headers: { "content-type": "application/json" } });
    })
  );
  return calls;
}

function makeClient() {
  let stored: string | undefined = "stale-token";
  const client = createApiClient({
    baseUrl: "https://api.test",
    getCsrfToken: () => stored,
    setCsrfToken: (t) => {
      stored = t;
    }
  });
  return { client, getStored: () => stored };
}

afterEach(() => vi.unstubAllGlobals());

describe("api-client CSRF self-heal (refresh via /me, retry exactly once)", () => {
  it("a mutation failing auth.csrf_invalid refreshes /me and retries ONCE with the fresh token", async () => {
    const calls = stubFetchSequence([
      { status: 403, body: CSRF_403 }, // original mutation → stale csrf
      { status: 200, body: ME_OK }, // GET /me → rotated token
      { status: 200, body: JSON.stringify({ invite: { id: "i1" } }) } // retry → success
    ]);
    const { client, getStored } = makeClient();
    const result = await client.request<{ invite: { id: string } }>("/api/v1/households/h1/members/invite", {
      method: "POST",
      body: JSON.stringify({ phone: "+972500000000" })
    });
    expect(result.invite.id).toBe("i1");
    expect(calls).toHaveLength(3);
    expect(calls[0]!.csrfHeader).toBe("stale-token");
    expect(calls[1]!.method).toBe("GET");
    expect(calls[1]!.url).toContain("/api/v1/me");
    expect(calls[2]!.csrfHeader).toBe("fresh-token"); // retry re-reads the refreshed token
    expect(getStored()).toBe("fresh-token");
  });

  it("does NOT retry forever: a second auth.csrf_invalid after the refresh throws (3 calls total)", async () => {
    const calls = stubFetchSequence([
      { status: 403, body: CSRF_403 },
      { status: 200, body: ME_OK },
      { status: 403, body: CSRF_403 } // retry fails too → give up
    ]);
    const { client } = makeClient();
    const err = await client
      .request("/api/v1/households/h1/members/invite", { method: "POST", body: "{}" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("auth.csrf_invalid");
    expect(calls).toHaveLength(3); // original + /me + ONE retry — never a 4th call
  });

  it("a failed /me refresh (dead session) surfaces the ORIGINAL csrf error, no retry", async () => {
    const calls = stubFetchSequence([
      { status: 403, body: CSRF_403 },
      { status: 401, body: JSON.stringify({ error: { code: "auth.unauthorized", message: "Authentication required" } }) }
    ]);
    const { client } = makeClient();
    const err = await client.request("/api/v1/x", { method: "POST", body: "{}" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("auth.csrf_invalid");
    expect(calls).toHaveLength(2); // original + /me only
  });

  it("non-CSRF failures are NOT retried and NOT masked (auth.forbidden stays auth.forbidden)", async () => {
    const calls = stubFetchSequence([
      { status: 403, body: JSON.stringify({ error: { code: "auth.forbidden", message: "Only owner/admin can invite members" } }) }
    ]);
    const { client } = makeClient();
    const err = await client.request("/api/v1/x", { method: "POST", body: "{}" }).catch((e: unknown) => e);
    expect((err as ApiClientError).code).toBe("auth.forbidden");
    expect(calls).toHaveLength(1);
  });

  it("GET requests are never csrf-retried", async () => {
    const calls = stubFetchSequence([{ status: 403, body: CSRF_403 }]);
    const { client } = makeClient();
    const err = await client.request("/api/v1/me").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(calls).toHaveLength(1);
  });
});
