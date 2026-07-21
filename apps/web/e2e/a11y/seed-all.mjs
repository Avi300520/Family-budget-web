// Seed every REAL state the verification run needs, immediately before it runs.
// Re-runnable: each run uses a fresh block of phone numbers, so nothing collides with a
// previous run's households and no /l token can be stale.
//   /l  -> active | mixed (partial 5/9 + חסר + bought) | locked (completed, read-only) | invalid
//   /join       -> a real unconsumed invite token
//   /onboarding -> an authenticated session with no household (the REAL wizard)
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";

const API = process.env.SEED_API ?? "http://localhost:4100";
const COOKIE = "shopping_assistant_session";
const dir = new URL("./", import.meta.url);
const counterFile = new URL("./.seed-counter", dir);

let base = existsSync(counterFile) ? Number(readFileSync(counterFile, "utf8")) || 1000 : 1000;
base += 100;
writeFileSync(counterFile, String(base));
let seq = base;
const nextPhone = () => `+9725${String(seq++).padStart(8, "0")}`;

const hdr = (c, x) => ({ "content-type": "application/json", ...(c ? { cookie: `${COOKIE}=${c}` } : {}), ...(x ? { "x-csrf-token": x } : {}) });
function cookieOf(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of all) { const m = /shopping_assistant_session=([^;]+)/.exec(c); if (m && m[1] && m[1] !== "deleted") return m[1]; }
  return null;
}
async function post(p, b, c, x) {
  const r = await fetch(`${API}${p}`, { method: "POST", headers: hdr(c, x), body: JSON.stringify(b ?? {}) });
  if (!r.ok) throw new Error(`POST ${p} -> ${r.status} ${await r.text()}`);
  return r;
}
const getJson = async (p, c) => {
  const r = await fetch(`${API}${p}`, { headers: hdr(c) });
  if (!r.ok) throw new Error(`GET ${p} -> ${r.status}`);
  return r.json();
};
async function mintMagicToken(phone) {
  await post("/api/v1/auth/magic-link/request", { phone, channel: "whatsapp", purpose: "login" });
  const links = ((await getJson("/api/v1/dev/inbox")).magicLinks ?? []).filter((m) => m.phone === phone);
  if (!links.length) throw new Error(`no magic link for ${phone}`);
  return new URL(links[0].link).searchParams.get("token"); // dev inbox is newest-first
}
async function login(phone) {
  const res = await post("/api/v1/auth/magic-link/consume", { token: await mintMagicToken(phone) });
  const cookie = cookieOf(res);
  await res.json();
  if (!cookie) throw new Error(`no session cookie for ${phone}`);
  return cookie;
}
// /me rotates the session CSRF (apps/api/src/server.ts:497) — always take the fresh one.
const csrfOf = async (cookie) => (await getJson("/api/v1/me", cookie)).csrfToken;

const ITEMS = [
  { rawText: "עגבניות", quantity: 3 }, { rawText: "מלפפונים" }, { rawText: "לחם" },
  { rawText: "חלב", quantity: 2 }, { rawText: "ביצים", quantity: 9 }, { rawText: "אורז" },
  { rawText: "במבה" }, { rawText: "גלידה" }, { rawText: "סבון כלים" },
];

async function household(name) {
  const phone = nextPhone();
  const cookie = await login(phone);
  const onb = await (await post("/api/v1/onboarding/complete", {
    displayName: "אבי", householdName: name, monthlyBudgetAmount: 8000,
    defaultCity: "תל אביב", budgetCycleDay: 1, acceptTerms: true, acceptPrivacy: true,
  }, cookie, await csrfOf(cookie))).json();
  const hid = onb.household.id;
  for (const it of ITEMS) await post(`/api/v1/households/${hid}/shopping-list/items`, it, cookie, await csrfOf(cookie));
  await post(`/api/v1/households/${hid}/shopping-list/send-to-whatsapp`, {}, cookie, await csrfOf(cookie));
  let token = null;
  for (const o of ((await getJson("/api/v1/dev/inbox")).outbox ?? []).filter((o) => o.destination === phone)) {
    const m = /\/l\/([A-Za-z0-9_-]{20,})/.exec(o.payload?.text ?? ""); if (m) token = m[1];
  }
  if (!token) throw new Error(`no share token for ${name}`);
  return { hid, cookie, phone, token };
}
const list = (t) => getJson(`/l/${t}`);
const act = (t, id, body) => post(`/l/${t}/items/${id}`, body);
const byName = (items, n) => { const i = items.find((x) => x.name.includes(n)); if (!i) throw new Error(`no item ${n}`); return i; };

(async () => {
  mkdirSync(new URL("./fixtures", dir), { recursive: true });
  const out = { apiBase: API, seedBase: base, invalid: "a11y-verify-invalid-token-000000000000" };

  const a = await household("בדיקה פעילה");
  out.active = a.token;

  const b = await household("בדיקה מעורבת");
  let bl = await list(b.token);
  await act(b.token, byName(bl.items, "ביצים").id, { action: "partial", quantityBought: 5 });
  await act(b.token, byName(bl.items, "גלידה").id, { action: "missing" });
  await act(b.token, byName(bl.items, "לחם").id, { action: "bought" });
  await act(b.token, byName(bl.items, "במבה").id, { action: "bought" });
  bl = await list(b.token);
  if (bl.completed) throw new Error("mixed auto-completed — adjust the fixture");
  out.mixed = b.token;

  const c = await household("בדיקה נעולה");
  let cl = await list(c.token);
  await act(c.token, byName(cl.items, "לחם").id, { action: "bought" });
  await act(c.token, byName(cl.items, "חלב").id, { action: "bought" });
  await act(c.token, byName(cl.items, "ביצים").id, { action: "partial", quantityBought: 4 });
  await act(c.token, byName(cl.items, "גלידה").id, { action: "missing" });
  await post(`/l/${c.token}/complete`, {});
  cl = await list(c.token);
  if (!cl.completed) throw new Error("locked state did not complete");
  out.locked = c.token;

  // A disposable list the keyboard test may mutate (buy / undo / partial / missing / finish)
  // without disturbing the read-only fixtures above.
  // one per browser project: the test finishes/locks the list, so they cannot share it
  out.mutable = { chromium: (await household("בדיקת מקלדת א")).token, webkit: (await household("בדיקת מקלדת ב")).token };

  // authenticated session with NO household -> the real /onboarding wizard
  const cookie = await login(nextPhone());
  writeFileSync(new URL("./fixtures/no-household.json", dir), JSON.stringify({
    cookies: [{ name: COOKIE, value: cookie, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86400, httpOnly: true, secure: false, sameSite: "Lax" }],
    origins: [],
  }, null, 2));

  // a real unconsumed invite -> /join's real phases
  const inv = await (await post(`/api/v1/households/${a.hid}/members/invite`,
    { phone: nextPhone(), displayName: "נועה", role: "adult_member" }, a.cookie, await csrfOf(a.cookie))).json();
  out.joinToken = new URL(inv.joinLink).searchParams.get("token");

  writeFileSync(new URL("./states.json", dir), JSON.stringify(out, null, 2));
  console.log("SEED OK", JSON.stringify(out));
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
