// Smoke seed — drives the memory-mode API (:4100) to create 4 Playwright fixtures.
// owner-with-data (onboarded + cap/project/shopping), adult-with-data, limited-with-data, owner-empty.
import { writeFileSync, mkdirSync } from "node:fs";

const API = process.env.SEED_API ?? "http://localhost:4100";
const COOKIE = "shopping_assistant_session";
const FIX = "apps/web/e2e/fixtures";
mkdirSync(FIX, { recursive: true });

function setCookieValue(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of all) {
    const m = /shopping_assistant_session=([^;]+)/.exec(c);
    if (m && m[1] !== "" && m[1] !== "deleted") return m[1];
  }
  return null;
}
const jhdr = (cookie, csrf) => ({
  "content-type": "application/json",
  ...(cookie ? { cookie: `${COOKIE}=${cookie}` } : {}),
  ...(csrf ? { "x-csrf-token": csrf } : {}),
});
async function jpost(path, body, cookie, csrf) {
  const res = await fetch(`${API}${path}`, { method: "POST", headers: jhdr(cookie, csrf), body: JSON.stringify(body) });
  return res;
}

async function magicConsume(phone) {
  await jpost("/api/v1/auth/magic-link/request", { phone, purpose: "login" });
  const inbox = await (await fetch(`${API}/api/v1/dev/inbox`)).json();
  const entries = (inbox.outbox ?? []).filter((o) => o.destination === phone && o.payload?.magicLink);
  if (!entries.length) throw new Error(`no magic link for ${phone}`);
  const link = entries[entries.length - 1].payload.magicLink;
  const token = new URL(link).searchParams.get("token");
  const res = await jpost("/api/v1/auth/magic-link/consume", { token });
  const cookie = setCookieValue(res);
  const body = await res.json().catch(() => ({}));
  if (!cookie) throw new Error(`consume gave no cookie for ${phone}: ${res.status} ${JSON.stringify(body)}`);
  return { cookie, csrf: body.csrfToken, user: body.user };
}

function writeFixture(name, cookie) {
  const fixture = {
    cookies: [{
      name: COOKIE, value: cookie, domain: "localhost", path: "/",
      expires: Math.floor(Date.now() / 1000) + 30 * 86400,
      httpOnly: true, secure: false, sameSite: "Lax",
    }],
    origins: [],
  };
  writeFileSync(`${FIX}/${name}.json`, JSON.stringify(fixture, null, 2));
  console.log(`  wrote ${name}.json`);
}

async function tryStep(label, fn) {
  try { await fn(); console.log(`  ok: ${label}`); }
  catch (e) { console.log(`  SKIP ${label}: ${e.message}`); }
}

(async () => {
  // ── Owner: magic -> onboard -> data ──────────────────────────────────────
  console.log("owner...");
  const owner = await magicConsume("+972500000001");
  const onbRes = await jpost("/api/v1/onboarding/complete", {
    displayName: "אבי מיזלס", householdName: "מיזלס", monthlyBudgetAmount: 15000,
    defaultCity: "בני ברק", budgetCycleDay: 1, acceptTerms: true, acceptPrivacy: true,
  }, owner.cookie, owner.csrf);
  if (!onbRes.ok) throw new Error(`onboard failed ${onbRes.status} ${await onbRes.text()}`);
  const onb = await onbRes.json();
  const hid = onb.household.id;
  console.log(`  household ${hid}`);
  writeFixture("owner-with-data", owner.cookie);

  // best-effort data so screens are non-empty
  await tryStep("category cap", async () => {
    const r = await fetch(`${API}/api/v1/households/${hid}/category-budgets/supermarket`, {
      method: "PUT", headers: jhdr(owner.cookie, owner.csrf), body: JSON.stringify({ monthlyLimit: 2500 }) });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  });
  await tryStep("project", async () => {
    const r = await jpost(`/api/v1/households/${hid}/project-budgets`,
      { name: "חופשת קיץ", totalAmount: 6000, endDate: "2026-08-16" }, owner.cookie, owner.csrf);
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  });
  await tryStep("shopping item", async () => {
    const r = await jpost(`/api/v1/households/${hid}/shopping-list/items`, { rawText: "חלב" }, owner.cookie, owner.csrf);
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  });

  // ── Adult + limited: invite -> join/direct ───────────────────────────────
  for (const [phone, role, displayName, fixture] of [
    ["+972500000002", "adult_member", "מיכל", "adult-with-data"],
    ["+972500000003", "limited_member", "נועה", "limited-with-data"],
  ]) {
    console.log(`${role}...`);
    const inv = await jpost(`/api/v1/households/${hid}/members/invite`,
      { phone, displayName, role }, owner.cookie, owner.csrf);
    if (!inv.ok) throw new Error(`invite ${role} failed ${inv.status} ${await inv.text()}`);
    const { joinLink } = await inv.json();
    const token = new URL(joinLink).searchParams.get("token");
    const joinRes = await jpost("/api/v1/households/join/direct", { inviteToken: token, displayName });
    if (!joinRes.ok) throw new Error(`join/direct ${role} failed ${joinRes.status} ${await joinRes.text()}`);
    const cookie = setCookieValue(joinRes);
    if (!cookie) throw new Error(`join/direct ${role} gave no cookie`);
    writeFixture(fixture, cookie);
  }

  // ── Owner-empty: magic only, no onboarding ───────────────────────────────
  console.log("owner-empty...");
  const empty = await magicConsume("+972500000009");
  writeFixture("owner-empty", empty.cookie);

  console.log("SEED DONE");
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
