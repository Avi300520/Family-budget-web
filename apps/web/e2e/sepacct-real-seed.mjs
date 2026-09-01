// Real-backend browser fixture for the separate-money join/start path.
// It writes only disposable Playwright-compatible state under e2e/fixtures.
import { mkdirSync, writeFileSync } from "node:fs";

const API = process.env.SEED_API ?? "http://localhost:4100";
const COOKIE = "shopping_assistant_session";
const FIX = "apps/web/e2e/fixtures";
mkdirSync(FIX, { recursive: true });

const headers = (cookie, csrf) => ({
  "content-type": "application/json",
  ...(cookie ? { cookie: `${COOKIE}=${cookie}` } : {}),
  ...(csrf ? { "x-csrf-token": csrf } : {})
});
const request = (method, path, body, auth = {}) => fetch(`${API}${path}`, {
  method, headers: headers(auth.cookie, auth.csrf), body: body === undefined ? undefined : JSON.stringify(body)
});

function cookieFrom(response) {
  const values = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const match = /shopping_assistant_session=([^;]+)/.exec(value);
    if (match?.[1] && match[1] !== "deleted") return match[1];
  }
  throw new Error("authentication response did not set a session cookie");
}

async function json(response, label) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function login(phone) {
  await json(await request("POST", "/api/v1/auth/magic-link/request", { phone, purpose: "login" }), "magic request");
  const inbox = await json(await fetch(`${API}/api/v1/dev/inbox`), "dev inbox");
  const entry = inbox.outbox.filter((item) => item.destination === phone && item.payload?.magicLink).at(-1);
  if (!entry) throw new Error(`no magic link for ${phone}`);
  const token = new URL(entry.payload.magicLink).searchParams.get("token");
  const response = await request("POST", "/api/v1/auth/magic-link/consume", { token });
  const body = await json(response, "magic consume");
  return { cookie: cookieFrom(response), csrf: body.csrfToken, user: body.user };
}

function writeState(name, cookie) {
  writeFileSync(`${FIX}/${name}.json`, JSON.stringify({
    cookies: [{ name: COOKIE, value: cookie, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86400, httpOnly: true, secure: false, sameSite: "Lax" }],
    origins: []
  }, null, 2));
}

const owner = await login("+972500000032");
const onboarding = await json(await request("POST", "/api/v1/onboarding/complete", {
  displayName: "רותם", householdName: "בית התרחישים", monthlyBudgetAmount: 12000,
  defaultCity: "חיפה", budgetCycleDay: 1, acceptTerms: true, acceptPrivacy: true,
  baseline: {
    version: 1,
    mode: "quick",
    profile: { type: "couple", adults: 2, kids: 0, kidAges: [], cars: 0 },
    cycle: { basis: "calendar", startDay: 1, salaryDay: 1, incomeCount: 1 },
    budget: { mode: "budget", managedMonthlyBudget: 12000 },
    fixedExpenses: [],
    subBudgets: {},
    alerts: {}
  }
}, owner), "onboarding");
const householdId = onboarding.household.id;
await json(await request("PUT", `/api/v1/households/${householdId}/separate-accounts`, {
  separateAccounts: true,
  defaultSplit: [{ userId: owner.user.id, shareBp: 5500 }]
}, owner), "pending arrangement");
const invitation = await json(await request("POST", `/api/v1/households/${householdId}/members/invite`, {
  phone: "+972500000033", role: "adult_member"
}, owner), "adult invite");

writeState("sepacct-real-manager", owner.cookie);
writeFileSync(`${FIX}/sepacct-real-meta.json`, JSON.stringify({
  joinUrl: new URL(invitation.joinLink).pathname + new URL(invitation.joinLink).search,
  householdId,
  ownerUserId: owner.user.id,
  ownerCookie: owner.cookie,
  ownerCsrf: owner.csrf
}, null, 2));
console.log(JSON.stringify({ joinUrl: new URL(invitation.joinLink).pathname + new URL(invitation.joinLink).search, householdId }));
