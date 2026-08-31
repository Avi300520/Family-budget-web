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
 *   adult      the viewer is an adult_member with NO manager permission - the door on
 *              /dashboard/spending must then appear only on rows the viewer paid for
 *   adultnopay same, and every row belongs to the partner: a non-manager with NO splittable row,
 *              which must be EXPLAINED rather than silently door-less (`R-1` F4)
 */

import { createServer } from "node:http";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const PORT = Number(arg("port", 4999));
let mode = arg("mode", "populated");
/** What the wizard last posted to `/onboarding/complete`, so the walk can assert an ABSENCE. */
let lastOnboarding = null;

const HOUSEHOLD = "7bf6b573-6e69-4ec3-a6ba-8c0be3fbd9c5";
const VIEWER = "98b1bf2e-3c99-4ca3-9a0a-7208f208bd9a";
const PARTNER = "1147b716-97cc-4ce8-aa86-0ed39e36d7cf";
const CHILD = "5f2c9d21-4a6e-42b7-9c31-6b0a7e8d4411";
const PURCHASE = "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d";
const UNSPLIT = "f0d3b8a5-1c47-4a92-8e6d-2b5c7a91d0f3";
const SPLITTABLE = "3c1a9e77-2b48-4d61-9f05-7a2e6c8b41d9";
const PARTNER_PAID = "8e4d5b12-6c37-4a90-b2e8-1f9c0d3a5b76";
const PRE_ARRANGEMENT = "5b7e2a94-0d13-4c68-8a5f-3e6b9d1c7048";

/** The household's declaration instant. The door's `createdAt > declaredAt` bound is read off it. */
const DECLARED_AT = "2026-08-20T07:30:00.000Z";

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
    purchase: { id: UNSPLIT, merchantNameRaw: null, purchaseDate: "2026-08-22", userId: null },
    allocation: null,
  },
  // The FIRST-SPLIT case: a real expense, a real payer, no allocation yet. `unsplitTotal` stands in
  // for the purchase total the server would resolve against, since there is no allocation to read
  // one from - without it a created split resolves every share to zero and proves nothing.
  [SPLITTABLE]: {
    purchase: { id: SPLITTABLE, merchantNameRaw: "רמי לוי", purchaseDate: "2026-08-24", userId: VIEWER },
    allocation: null,
    unsplitTotal: 24000,
  },
  [PARTNER_PAID]: {
    purchase: { id: PARTNER_PAID, merchantNameRaw: "פארם", purchaseDate: "2026-08-25", userId: PARTNER },
    allocation: null,
    unsplitTotal: 8000,
  },
  [PRE_ARRANGEMENT]: {
    purchase: { id: PRE_ARRANGEMENT, merchantNameRaw: "לפני ההסדר", purchaseDate: "2026-08-19", userId: VIEWER },
    allocation: null,
    unsplitTotal: 5000,
  },
};

/**
 * `GET …/purchases/period` - the pre-existing dashboard feed the DOOR is rendered from. Every row
 * exercises one branch of the door's condition, so a probe can assert the link appears on exactly
 * the rows the server would accept a split for:
 *   SPLITTABLE       payer = viewer, after the declaration        -> link in every mode
 *   PARTNER_PAID     payer = partner, after the declaration       -> link ONLY for a manager
 *   PURCHASE         already split, payer = partner               -> link ONLY for a manager
 *   UNSPLIT          NO payer (de-attributed)                     -> never a link (409 no_payer)
 *   PRE_ARRANGEMENT  recorded BEFORE the declaration              -> never a link (409 before_arrangement)
 */
const PERIOD_ROWS = [
  { id: SPLITTABLE, userId: VIEWER, merchantNameRaw: "רמי לוי", purchaseDate: "2026-08-24", totalAmount: 240, createdAt: "2026-08-24T10:00:00.000Z", category: "supermarket" },
  { id: PARTNER_PAID, userId: PARTNER, merchantNameRaw: "פארם", purchaseDate: "2026-08-25", totalAmount: 80, createdAt: "2026-08-25T10:00:00.000Z", category: "pharmacy_health" },
  { id: PURCHASE, userId: PARTNER, merchantNameRaw: "סופר השכונה", purchaseDate: "2026-08-24", totalAmount: 186.7, createdAt: "2026-08-24T18:00:00.000Z", category: "supermarket" },
  { id: UNSPLIT, userId: undefined, merchantNameRaw: "בלי משלם", purchaseDate: "2026-08-22", totalAmount: 50, createdAt: "2026-08-22T10:00:00.000Z", category: "other" },
  { id: PRE_ARRANGEMENT, userId: VIEWER, merchantNameRaw: "לפני ההסדר", purchaseDate: "2026-08-19", totalAmount: 50, createdAt: "2026-08-19T10:00:00.000Z", category: "other" },
].map((r) => ({
  householdId: HOUSEHOLD, currency: "ILS", source: "manual_whatsapp", expenseType: "household", status: "confirmed",
  updatedAt: r.createdAt, ...r,
}));

let income = { monthlyAgorot: 1825000 };

/** The pristine fixture, captured once. `/__reset` restores it so the walk is repeatable. */
const CONFIG_SEED = structuredClone(config);
const SPLITS_SEED = structuredClone(splits);
const INCOME_SEED = structuredClone(income);

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
        financialBaseline: { version: 1, mode: "guided", fixedExpenses: [], subBudgets: {}, profile: { type: "couple_kids", adults: 2, kids: 1, kidAges: [], cars: 1, separateAccounts: true, separateAccountsDeclaredAt: DECLARED_AT } },
      },
      membership: (mode === "adult" || mode === "adultnopay")
        ? { id: "m1", householdId: HOUSEHOLD, userId: VIEWER, role: "adult_member", permissions: {}, joinedAt: "2026-01-01T00:00:00.000Z", status: "active" }
        : { id: "m1", householdId: HOUSEHOLD, userId: VIEWER, role: "owner", permissions: { all: true }, joinedAt: "2026-01-01T00:00:00.000Z", status: "active" }
      }),
    });
  }
  if (p === `/api/v1/households/${HOUSEHOLD}/members`) {
    return send(res, 200, { members: MEMBERS.map((m, i) => ({ id: `m${i}`, householdId: HOUSEHOLD, userId: m.userId, role: m.role, permissions: {}, joinedAt: "2026-01-01T00:00:00.000Z", status: "active", displayName: m.displayName })) });
  }
  if (p === `/api/v1/households/${HOUSEHOLD}/purchases/period`) {
    // `adultnopay`: every row belongs to the partner, so a non-manager viewer has NOTHING they may
    // split. That is the state `R-1` F4 found silent - no door on any row and no sentence saying
    // why - and it cannot be reached from `adult` alone, where the viewer still paid for one row.
    const rows = mode === "adultnopay" ? PERIOD_ROWS.map((r) => ({ ...r, userId: r.userId ? PARTNER : r.userId })) : PERIOD_ROWS;
    return send(res, 200, { purchases: rows, periodStart: "2026-08-01", periodEnd: "2026-08-31" });
  }
  // Let the harness flip modes without a restart.
  if (p === "/__mode") { mode = url.searchParams.get("to") ?? mode; return send(res, 200, { mode }); }
  // ⚠️ **AND LET IT RESET, BECAUSE THE WALK MUTATES THIS PROCESS.** `splits`, `config` and `income`
  // are module state: a walk that clicks אני נושא/ת בכל הסכום leaves the fixture at 100/0, and the
  // NEXT run then finds the button correctly hidden and reports a failure that is its own residue.
  // Measured: the second walk against an unchanged build failed for exactly that reason. A walk you
  // can only run once is not a walk.
  if (p === "/__reset") { splits = structuredClone(SPLITS_SEED); config = structuredClone(CONFIG_SEED); income = structuredClone(INCOME_SEED); lastOnboarding = null; return send(res, 200, { reset: true }); }

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
    // `CC_UX_BUILD` item 4 / ruling `R-a` — THE PENDING SHAPE. A household declaring in the wizard
    // has exactly ONE adult, so the ratio it types can only be stored as its own share with the
    // counterpart unnamed. The route accepts one share naming the CALLER at `shareBp < 10000`,
    // stores it, and does NOT declare. `fresh` is the mode where that household exists.
    const pending = mode === "fresh" && next.separateAccounts && next.defaultSplit.length === 1
      && next.defaultSplit[0].userId === VIEWER && next.defaultSplit[0].shareBp > 0 && next.defaultSplit[0].shareBp < 10000;
    if (!pending && next.separateAccounts && (next.defaultSplit.length === 0 || sum !== 10000)) return fail(res, 400, "split.invalid", "Invalid");
    if (next.defaultSplit.some((s) => MEMBERS.find((m) => m.userId === s.userId)?.role === "limited_member")) return fail(res, 400, "split.not_a_member", "Not a member");
    config = { ...config, separateAccounts: next.separateAccounts, defaultSplit: next.defaultSplit };
    return send(res, 200, config);
  }

  const split = /^\/api\/v1\/households\/([^/]+)\/purchases\/([^/]+)\/split$/.exec(p);
  if (split) {
    const found = splits[split[2]];
    if (req.method === "GET") {
      if (!found) return fail(res, 404, "split.not_found", "Not found");
      // `empty` means "this purchase has no split rows", NOT "every purchase is the payer-less
      // one". Returning `splits[UNSPLIT]` for every id also returned its total of zero, so a walk
      // that created a split rendered ₪0.00 three times and looked green while proving nothing
      // about the money. Keep the requested purchase's identity and drop only its allocation.
      return send(res, 200, mode === "empty" ? { ...found, allocation: null } : found);
    }
    if (req.method === "PUT") {
      if (!found) return fail(res, 404, "purchase.not_found", "Not found");
      const { shares } = await readBody(req);
      if (!Array.isArray(shares)) return fail(res, 400, "split.invalid", "Invalid");
      const total = found.allocation?.totalAgorot ?? found.unsplitTotal ?? 0;
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

  // ── `CC_UX_BUILD` items 4 and 5 — the routes the WIZARD and the JOIN walk need. ──────────────
  //
  // These are not SEPACCT routes and are deliberately outside the `isSepacct` mode switch above:
  // a walk that cannot complete onboarding or accept an invite cannot reach screens A, B, C or D
  // at all, in any mode.

  // The wizard's whole-document save. It answers the shape `useOnboardingWizard` reads —
  // `{ user, household }` — and NOTHING else, because the two writes that follow it (the pending
  // ratio and the private income) are separate routes on purpose and the walk must prove they run.
  if (p === "/api/v1/onboarding/complete" && req.method === "POST") {
    const payload = await readBody(req);
    lastOnboarding = payload;
    return send(res, 200, {
      user: { id: VIEWER, phoneE164: "+972500000000", displayName: payload.displayName ?? "נועה", locale: "he", status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      household: { id: HOUSEHOLD, ownerUserId: VIEWER, name: payload.householdName ?? "בית", monthlyBudgetAmount: payload.monthlyBudgetAmount ?? 0, currency: "ILS", budgetCycleDay: 1, status: "active" }
    });
  }
  // What the wizard actually posted, so the walk can assert the ABSENCE of a shared income rather
  // than only that the screen did not show a field for it.
  if (p === "/__onboarding" && req.method === "GET") return send(res, 200, lastOnboarding ?? {});

  // The invite preview and the two join doors. `joinHousehold` is the warm door and
  // `joinHouseholdDirect` the cold one; both return `member`, which is where screen D gets the
  // joiner's own id from (never `/me`, which is a write).
  if (p === "/api/v1/households/join" && req.method === "GET") {
    return send(res, 200, { invite: { id: "inv-1", householdId: HOUSEHOLD, role: "adult_member", invitedPhone: "+972500000001", expiresAt: "2030-01-01T00:00:00.000Z" }, household: { id: HOUSEHOLD, name: "בית לדוגמה" } });
  }
  if ((p === "/api/v1/households/join" || p === "/api/v1/households/join/direct") && req.method === "POST") {
    // The JOINER is the partner, not the viewer: screen D is drawn for the person who did NOT
    // configure the arrangement, and a stub that hands back the setter's id would let a wrong
    // implementation (`shares[0]`, or "the other name") look right.
    return send(res, 200, {
      member: { id: "m2", householdId: HOUSEHOLD, userId: PARTNER, role: "adult_member", permissions: {}, joinedAt: "2026-08-31T00:00:00.000Z", status: "active" },
      household: { id: HOUSEHOLD, ownerUserId: VIEWER, name: "בית לדוגמה", monthlyBudgetAmount: 12000, currency: "ILS", budgetCycleDay: 1, status: "active" },
      user: { id: PARTNER, phoneE164: "+972500000001", displayName: "אורי", locale: "he", status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      csrfToken: "stub-csrf"
    });
  }

  return fail(res, 404, "http.not_found", "Not found");
});

server.listen(PORT, "127.0.0.1", () => console.log(`sepacct stub on http://127.0.0.1:${PORT} mode=${mode}`));
