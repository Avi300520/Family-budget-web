#!/usr/bin/env node
/**
 * apps/web/e2e/sepacct-stub.mjs - a stand-in API for measuring the SEPACCT surfaces.
 *
 * This is NOT the mock that was deleted. The difference is where it sits: `lib/sepacctMock.ts`
 * lived inside `src/` and the pages imported it, so no page ever exercised a fetch. This is a
 * separate PROCESS on the other side of `NEXT_PUBLIC_API_URL`, so the pages under measurement run
 * the real client - real CORS, real credentials, the real CSRF header, the real `DomainError`
 * envelope and the real status codes - and nothing about it can reach a production bundle.
 *
 *   node apps/web/e2e/sepacct-stub.mjs --port 4999 --mode populated
 *
 * Modes affect ONLY the SEPACCT routes; `/api/v1/me` and `/members` always answer, because every
 * SEPACCT surface needs an identity before it can fail on anything else.
 *
 *   populated  the shapes of SEPACCT_FRONTEND_SPEC.md, arrangement ON
 *   off        same, but `separateAccounts: false` - the OFF direction, as stored
 *   empty      no split rows, no entries, income null, zero components
 *   window     populated, plus a non-null `windowOpenedAt` (the member left and rejoined)
 *   dormant    404 `http.not_found` on every SEPACCT route - the flag-off wire (spec section 3)
 *   error      500 `http.internal` - a server failure that is NOT a 404, which the deleted mock
 *              could not produce and which must render as an ERROR, never as absence
 *   forbidden  403 `auth.forbidden` on the arrangement - a non-manager reader
 *   fresh      a user with no household at all, so /onboarding renders the wizard
 */

import { createServer } from "node:http";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const PORT = Number(arg("port", 4999));
let mode = arg("mode", "populated");

const HOUSEHOLD = "7bf6b573-6e69-4ec3-a6ba-8c0be3fbd9c5";
const VIEWER = "98b1bf2e-3c99-4ca3-9a0a-7208f208bd9a";
const PARTNER = "1147b716-97cc-4ce8-aa86-0ed39e36d7cf";
const CHILD = "5f2c9d21-4a6e-42b7-9c31-6b0a7e8d4411";
const PURCHASE = "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d";
const UNSPLIT = "f0d3b8a5-1c47-4a92-8e6d-2b5c7a91d0f3";

const MEMBERS = [
  { userId: VIEWER, displayName: "נועה", role: "owner" },
  { userId: PARTNER, displayName: "אורי", role: "adult_member" },
  { userId: CHILD, displayName: "יעל", role: "limited_member" },
];

// Money is integer agorot and shares are integer basis points, everywhere. 18670 is the whole
// expense; 9335 + 9335 is the server-resolved split, and the page must render those verbatim.
let config = {
  separateAccounts: true,
  members: MEMBERS,
  defaultSplit: [
    { userId: VIEWER, shareBp: 5000 },
    { userId: PARTNER, shareBp: 5000 },
  ],
};

let splits = {
  [PURCHASE]: {
    purchase: { id: PURCHASE, merchantNameRaw: "סופר השכונה", purchaseDate: "2026-08-24", userId: PARTNER },
    allocation: {
      purchaseId: PURCHASE,
      totalAgorot: 18670,
      shares: [
        { userId: VIEWER, shareBp: 5000, agorot: 9335, previousShareBp: 6000, disputedAt: null },
        { userId: PARTNER, shareBp: 5000, agorot: 9335, previousShareBp: 4000, disputedAt: null },
      ],
    },
  },
  // All three fallbacks at once: no allocation, no merchant name, no recorder.
  [UNSPLIT]: {
    purchase: { id: UNSPLIT, merchantNameRaw: null, purchaseDate: "2026-08-19", userId: null },
    allocation: null,
  },
};

let income = { monthlyAgorot: 1825000 };

/** The server's rule: floor every part, then hand the remainder out by shareBp desc, userId asc. */
function resolve(totalAgorot, shares) {
  const parts = shares.map((s) => ({ ...s, agorot: Math.floor((totalAgorot * s.shareBp) / 10000) }));
  let rest = totalAgorot - parts.reduce((sum, p) => sum + p.agorot, 0);
  [...parts]
    .sort((a, b) => b.shareBp - a.shareBp || a.userId.localeCompare(b.userId))
    .forEach((p) => {
      if (rest > 0) { p.agorot += 1; rest -= 1; }
    });
  return parts;
}

const components = () => ({
  recordedAgorot: mode === "empty" ? 0 : 250000,
  shareAgorot: mode === "empty" ? 0 : 187000,
  settledOutAgorot: 0,
  settledInAgorot: 0,
  windowOpenedAt: mode === "window" ? "2026-06-01T00:00:00.000Z" : null,
});

function send(res, status, payload) {
  const text = payload === undefined ? "" : JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}
const fail = (res, status, code, message) => send(res, status, { error: { code, message: message ?? code } });

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });

const server = createServer(async (req, res) => {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, "http://stub");
  const p = url.pathname;

  // Identity and roster answer in EVERY mode: a surface must reach its SEPACCT call before the
  // mode can decide what that call does.
  if (p === "/api/v1/me") {
    return send(res, 200, {
      csrfToken: "stub-csrf",
      user: { id: VIEWER, phoneE164: "+972500000000", displayName: "נועה", locale: "he", status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      // mode "fresh" = a user with NO household at all, which is the only state in which
      // /onboarding renders the wizard rather than redirecting to the dashboard. The wizard's
      // "step N/TOTAL" counter is the built-artifact evidence for whether the separate-accounts
      // step shipped, so this mode exists to make that counter observable.
      ...(mode === "fresh" ? {} : {
      household: {
        id: HOUSEHOLD, ownerUserId: VIEWER, name: "בית לדוגמה", monthlyBudgetAmount: 12000, currency: "ILS",
        budgetCycleDay: 1, status: "active",
        financialBaseline: { version: 1, mode: "guided", fixedExpenses: [], subBudgets: {}, profile: { type: "couple_kids", adults: 2, kids: 1, kidAges: [], cars: 1, separateAccounts: true, separateAccountsDeclaredAt: "2026-08-20T07:30:00.000Z" } },
      },
      membership: { id: "m1", householdId: HOUSEHOLD, userId: VIEWER, role: "owner", permissions: { all: true }, joinedAt: "2026-01-01T00:00:00.000Z", status: "active" }
      }),
    });
  }
  if (p === `/api/v1/households/${HOUSEHOLD}/members`) {
    return send(res, 200, { members: MEMBERS.map((m, i) => ({ id: `m${i}`, householdId: HOUSEHOLD, userId: m.userId, role: m.role, permissions: {}, joinedAt: "2026-01-01T00:00:00.000Z", status: "active", displayName: m.displayName })) });
  }
  // Let the harness flip modes without a restart.
  if (p === "/__mode") { mode = url.searchParams.get("to") ?? mode; return send(res, 200, { mode }); }

  const isSepacct = /separate-accounts|\/split|my-income|my-components|my-record-components/.test(p);
  if (isSepacct) {
    if (mode === "dormant") return fail(res, 404, "http.not_found", "Not found");
    if (mode === "error") return fail(res, 500, "http.internal", "Internal error");
  }

  if (p === "/api/v1/households/current/separate-accounts" && req.method === "GET") {
    if (mode === "forbidden") return fail(res, 403, "auth.forbidden", "Forbidden");
    return send(res, 200, mode === "empty" ? { separateAccounts: false, members: MEMBERS, defaultSplit: [] } : { ...config, separateAccounts: mode !== "off" && config.separateAccounts });
  }
  if (p === `/api/v1/households/${HOUSEHOLD}/separate-accounts` && req.method === "PUT") {
    const next = await readBody(req);
    if (typeof next.separateAccounts !== "boolean" || !Array.isArray(next.defaultSplit)) return fail(res, 400, "split.invalid", "Invalid");
    // The sum rule applies ONLY when the arrangement is on: turning it off with a stale or empty
    // split is accepted, and the UI must not block that.
    const sum = next.defaultSplit.reduce((t, s) => t + s.shareBp, 0);
    if (next.separateAccounts && (next.defaultSplit.length === 0 || sum !== 10000)) return fail(res, 400, "split.invalid", "Invalid");
    if (next.defaultSplit.some((s) => MEMBERS.find((m) => m.userId === s.userId)?.role === "limited_member")) return fail(res, 400, "split.not_a_member", "Not a member");
    config = { ...config, separateAccounts: next.separateAccounts, defaultSplit: next.defaultSplit };
    return send(res, 200, config);
  }

  const split = /^\/api\/v1\/households\/([^/]+)\/purchases\/([^/]+)\/split$/.exec(p);
  if (split) {
    const found = splits[split[2]];
    if (req.method === "GET") {
      if (!found) return fail(res, 404, "split.not_found", "Not found");
      return send(res, 200, mode === "empty" ? splits[UNSPLIT] : found);
    }
    if (req.method === "PUT") {
      if (!found) return fail(res, 404, "purchase.not_found", "Not found");
      const { shares } = await readBody(req);
      if (!Array.isArray(shares)) return fail(res, 400, "split.invalid", "Invalid");
      const total = found.allocation?.totalAgorot ?? 0;
      const before = found.allocation?.shares ?? [];
      splits = { ...splits, [split[2]]: { ...found, allocation: { purchaseId: split[2], totalAgorot: total, shares: resolve(total, shares).map((part) => {
        const was = before.find((s) => s.userId === part.userId);
        return { ...part, previousShareBp: was && was.shareBp !== part.shareBp ? was.shareBp : (was?.previousShareBp ?? null), disputedAt: was?.disputedAt ?? null };
      }) } } };
      return send(res, 200, splits[split[2]]);
    }
  }

  const dispute = /^\/api\/v1\/households\/([^/]+)\/purchases\/([^/]+)\/split\/dispute$/.exec(p);
  if (dispute && req.method === "POST") {
    const found = splits[dispute[2]];
    if (!found?.allocation) return fail(res, 404, "split.not_found", "Not found");
    splits = { ...splits, [dispute[2]]: { ...found, allocation: { ...found.allocation, shares: found.allocation.shares.map((s) => (s.userId === VIEWER ? { ...s, disputedAt: s.disputedAt ?? "2026-08-27T09:15:00.000Z" } : s)) } } };
    // The wire returns NOTHING here, not the updated allocation. 204, empty body.
    res.writeHead(204);
    return res.end();
  }

  if (p === `/api/v1/households/${HOUSEHOLD}/my-income`) {
    if (req.method === "GET") return send(res, 200, mode === "empty" ? { monthlyAgorot: null } : income);
    if (req.method === "PUT") {
      const { monthlyAgorot } = await readBody(req);
      if (monthlyAgorot !== null && (!Number.isInteger(monthlyAgorot) || monthlyAgorot < 0)) return fail(res, 400, "income.invalid", "Invalid");
      income = { monthlyAgorot };
      return send(res, 200, income);
    }
  }

  if (p === `/api/v1/households/${HOUSEHOLD}/my-components` && req.method === "GET") return send(res, 200, components());

  if (p === `/api/v1/households/${HOUSEHOLD}/my-record-components` && req.method === "GET") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !DATE.test(from) || !DATE.test(to) || from > to) return fail(res, 400, "split.invalid", "Invalid range");
    if (mode === "empty") return send(res, 200, { entries: [] });
    const entries = Object.values(splits)
      .filter((s) => s.allocation)
      .map((s) => {
        const mine = s.allocation.shares.find((sh) => sh.userId === VIEWER);
        return mine && { purchaseId: s.purchase.id, merchantNameRaw: s.purchase.merchantNameRaw, purchaseDate: s.purchase.purchaseDate, recordedAgorot: s.allocation.totalAgorot, myShareAgorot: mine.agorot, disputedAt: mine.disputedAt };
      })
      .filter(Boolean);
    return send(res, 200, { entries });
  }

  return fail(res, 404, "http.not_found", "Not found");
});

server.listen(PORT, "127.0.0.1", () => console.log(`sepacct stub on http://127.0.0.1:${PORT} mode=${mode}`));
