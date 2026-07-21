import type { Page, BrowserContext, Browser } from "@playwright/test";
import path from "node:path";
import { ROOT, API, Target } from "./env";

export async function contextFor(browser: Browser, t: Target, extra: Record<string, unknown> = {}): Promise<BrowserContext> {
  return browser.newContext({
    ...(t.storage ? { storageState: path.join(ROOT, "fixtures", t.storage) } : {}),
    ...extra,
  } as never);
}

/** Navigate and let the client islands hydrate / the /l fetch settle. */
export async function open(page: Page, t: Target): Promise<void> {
  await page.goto(t.path, { waitUntil: "load", timeout: 30_000 });
  // /l polls forever, so networkidle can never fire there; settle on the h1 instead.
  await page.locator("h1").first().waitFor({ state: "attached", timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (t.marker) {
    const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    if (!t.marker.test(text)) {
      throw new Error(`STATE NOT REACHED for ${t.id}: expected ${t.marker} ("${t.state}") but the page reads: ${text.slice(0, 200)}`);
    }
  }
}

/** Return the accessibility menu to its defaults, so one page can be scanned in every mode. */
export async function resetMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "תפריט נגישות" }).click();
  await page.locator("#a11y-menu-panel").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "איפוס הגדרות הנגישות" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

/**
 * Drive the REAL accessibility menu with real clicks (open launcher -> toggle -> Escape),
 * exactly as a user would. Returns the resulting <html> data-a11y-* attribute set.
 */
export async function applyMode(page: Page, mode: { label: string | null; steps: number }): Promise<Record<string, string | null>> {
  if (!mode.label && mode.steps === 0) return readFlags(page);
  await page.getByRole("button", { name: "תפריט נגישות" }).click();
  await page.locator("#a11y-menu-panel").waitFor({ state: "visible" });
  if (mode.label) await page.getByRole("button", { name: mode.label, exact: false }).click();
  if (mode.steps > 0) {
    const plus = page.getByRole("button", { name: "הגדלת גודל הגופן" });
    for (let i = 0; i < mode.steps; i++) await plus.click();
  } else if (mode.steps < 0) {
    const minus = page.getByRole("button", { name: "הקטנת גודל הגופן" });
    for (let i = 0; i < -mode.steps; i++) await minus.click();
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  return readFlags(page);
}

export function readFlags(page: Page) {
  return page.evaluate(() => {
    const r = document.documentElement;
    return {
      contrast: r.getAttribute("data-a11y-contrast"),
      motion: r.getAttribute("data-a11y-motion"),
      links: r.getAttribute("data-a11y-links"),
      font: r.getAttribute("data-a11y-font"),
      zoom: r.style.zoom || null,
    };
  });
}

/* ------------------------------------------------------------------ contrast */

/**
 * Measure RENDERED contrast with getComputedStyle (project rule: never read the CSS rule).
 * Composites every ancestor background AND cumulative `opacity` — the exact bug class that
 * put /l's locked rows at 4.16:1 (CLAUDE.md: "opacity on a row is a contrast bug").
 */
export const measureContrast = `(() => {
  const parse = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1,L2), lo = Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
  const hex = (c) => '#' + [c.r,c.g,c.b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');

  // Walk up compositing background COLOURS, and stop the moment an ancestor paints a
  // background-IMAGE (gradient / photo). A pixel over a gradient has no single computable
  // backdrop, so those samples are reported as "undetermined", never as a failure — the same
  // stance axe takes when it returns "incomplete".
  const bgOf = (el) => {
    const stack = []; let n = el; let image = null;
    while (n) {
      const cs = getComputedStyle(n);
      if (!image && cs.backgroundImage && cs.backgroundImage !== 'none') image = cs.backgroundImage.slice(0, 60);
      const c = parse(cs.backgroundColor); if (c && c.a > 0) stack.push(c);
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return { colour: base, image };
  };
  const cumOpacity = (el) => { let o = 1, n = el;
    while (n) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; } return o; };
  const pathOf = (el) => { const bits = []; let n = el;
    while (n && n.nodeType === 1 && bits.length < 4) {
      bits.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/).slice(0,2).join('.') : ''));
      n = n.parentElement; }
    return bits.join(' > '); };

  const out = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    // direct text only — otherwise a wrapper inherits its children's text
    let text = '';
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue;
    text = text.replace(/\\s+/g, ' ').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;            // .sr-only is clipped to 1px
    const fg0 = parse(cs.color); if (!fg0) continue;
    const { colour: bg, image } = bgOf(el);
    const op = cumOpacity(el);
    const fg = over({ ...fg0, a: fg0.a * op }, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const req = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    out.push({ path: pathOf(el), text: text.slice(0, 48), fg: hex(fg), bg: hex(bg), fontPx: size, weight,
               large, required: req, ratio: Math.round(cr * 100) / 100, opacity: Math.round(op * 1000) / 1000,
               backgroundImage: image,
               undetermined: Boolean(image),
               pass: image ? null : cr + 0.005 >= req });
  }
  return out;
})()`;

/** 1.4.11 (WCAG 2.1, informational for a 2.0 AA statement): control boundary vs its surroundings. */
export const measureBoundaries = `(() => {
  const parse = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1,L2), lo = Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
  const hex = (c) => '#' + [c.r,c.g,c.b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
  const bgOf = (el) => { const stack = []; let n = el; let image = null;
    while (n) { const cs = getComputedStyle(n);
      if (!image && cs.backgroundImage && cs.backgroundImage !== 'none') image = true;
      const c = parse(cs.backgroundColor); if (c && c.a > 0) stack.push(c); n = n.parentElement; }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return { colour: base, image }; };

  const out = [];
  for (const el of document.querySelectorAll('button, input, select, textarea, [role=button], [role=checkbox], [role=radio]')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;
    const w = parseFloat(cs.borderTopWidth) || 0;
    if (w <= 0) { out.push({ tag: el.tagName.toLowerCase(), name: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,32), border: 'none', ratio: null, note: 'no border - boundary carried by background/shape' }); continue; }
    const bc = parse(cs.borderTopColor); if (!bc) continue;
    const { colour: outside, image } = bgOf(el.parentElement || document.body);
    if (image) { out.push({ tag: el.tagName.toLowerCase(), name: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,32), border: 'over background-image', ratio: null, note: 'undetermined - sits on a gradient/image' }); continue; }
    const eff = over(bc, outside);
    out.push({ tag: el.tagName.toLowerCase(), name: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,32),
               border: hex(eff), against: hex(outside), ratio: Math.round(ratio(eff, outside) * 100) / 100, pass: ratio(eff, outside) >= 3 });
  }
  return out;
})()`;

/* ------------------------------------------------------------------ keyboard */

export type TabStop = {
  index: number; tag: string; role: string | null; name: string; visibleText: string;
  outlineStyle: string; outlineWidth: string; outlineColor: string; boxShadow: string;
  hasIndicator: boolean; rect: { x: number; y: number; w: number; h: number } | null;
};

export const readFocused = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const outlineW = parseFloat(cs.outlineWidth) || 0;
  const hasIndicator = (cs.outlineStyle !== 'none' && outlineW > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  const name = (el.getAttribute('aria-label') || el.textContent || (el).value || '').replace(/\\s+/g, ' ').trim();
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    cls: typeof el.className === 'string' ? el.className : '',
    id: el.id || null,
    name: name.slice(0, 80),
    visibleText: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
    outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor,
    boxShadow: (cs.boxShadow || 'none').slice(0, 80),
    hasIndicator: Boolean(hasIndicator),
    rect: r.width || r.height ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
  };
})()`;

/** Tab from the very top of the document, recording every stop. Detects traps and dead ends. */
export async function tabWalk(page: Page, max = 90) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); document.body.focus?.(); });
  const stops: any[] = [];
  let sameCount = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    // Stamp the focused ELEMENT itself, so two identical-looking siblings are never mistaken
    // for a trap (the earlier heuristic false-positived on repeated links in /privacy).
    const s: any = await page.evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      if (!el.hasAttribute('data-a11y-walk')) el.setAttribute('data-a11y-walk', String(Math.random()).slice(2, 12));
      const base = ${readFocused};
      return { ...base, walkId: el.getAttribute('data-a11y-walk') };
    })()`);
    if (!s) { stops.push({ index: i, endOfDocument: true }); break; }
    const prev = stops[stops.length - 1];
    if (prev && prev.walkId === s.walkId) { sameCount++; if (sameCount >= 3) { stops.push({ ...s, index: i, trapped: true }); break; } }
    else sameCount = 0;
    stops.push({ ...s, index: i });
    if (i > 2 && stops[0] && s.walkId === stops[0].walkId) break; // full cycle
  }
  return stops;
}

/* ------------------------------------------------------------------ seeding */

let phoneSeq = 200;
const hdr = (c?: string, x?: string) => ({
  "content-type": "application/json",
  ...(c ? { cookie: `shopping_assistant_session=${c}` } : {}),
  ...(x ? { "x-csrf-token": x } : {}),
});
function cookieOf(res: Response): string | null {
  const all = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of all) { const m = /shopping_assistant_session=([^;]+)/.exec(c as string); if (m && m[1] && m[1] !== "deleted") return m[1]; }
  return null;
}
async function post(p: string, b: unknown, c?: string, x?: string) {
  const r = await fetch(`${API}${p}`, { method: "POST", headers: hdr(c, x), body: JSON.stringify(b ?? {}) });
  if (!r.ok) throw new Error(`POST ${p} -> ${r.status} ${await r.text()}`);
  return r;
}

/** Mint a brand-new household + populated share list, so a mutating test never disturbs a fixture. */
export async function mintList(items: Array<{ rawText: string; quantity?: number }>): Promise<{ token: string }> {
  const phone = `+9725000${String(phoneSeq++).padStart(5, "0")}`;
  await post("/api/v1/auth/magic-link/request", { phone, channel: "whatsapp", purpose: "login" });
  const inbox: any = await (await fetch(`${API}/api/v1/dev/inbox`)).json();
  const link = (inbox.magicLinks ?? []).filter((m: any) => m.phone === phone)[0];
  const tok = new URL(link.link).searchParams.get("token");
  const res = await post("/api/v1/auth/magic-link/consume", { token: tok });
  const cookie = cookieOf(res as unknown as Response)!;
  await res.json();
  const me: any = await (await fetch(`${API}/api/v1/me`, { headers: hdr(cookie) })).json();
  const csrf = me.csrfToken;
  const onb: any = await (await post("/api/v1/onboarding/complete", {
    displayName: "בודק", householdName: "בדיקת מקלדת", monthlyBudgetAmount: 5000,
    defaultCity: "חיפה", budgetCycleDay: 1, acceptTerms: true, acceptPrivacy: true,
  }, cookie, csrf)).json();
  const hid = onb.household.id;
  const me2: any = await (await fetch(`${API}/api/v1/me`, { headers: hdr(cookie) })).json();
  for (const it of items) await post(`/api/v1/households/${hid}/shopping-list/items`, it, cookie, me2.csrfToken);
  const me3: any = await (await fetch(`${API}/api/v1/me`, { headers: hdr(cookie) })).json();
  await post(`/api/v1/households/${hid}/shopping-list/send-to-whatsapp`, {}, cookie, me3.csrfToken);
  const inbox2: any = await (await fetch(`${API}/api/v1/dev/inbox`)).json();
  let token: string | null = null;
  for (const o of (inbox2.outbox ?? []).filter((o: any) => o.destination === phone)) {
    const m = /\/l\/([A-Za-z0-9_-]{20,})/.exec(o.payload?.text ?? ""); if (m) token = m[1];
  }
  if (!token) throw new Error("mintList: no share token");
  return { token };
}

/** A fresh, unconsumed magic-link token (they expire in 15 min, so mint at test time). */
export async function mintConsumeToken(): Promise<string> {
  const phone = `+9725000${String(phoneSeq++).padStart(5, "0")}`;
  await post("/api/v1/auth/magic-link/request", { phone, channel: "whatsapp", purpose: "login" });
  const inbox: any = await (await fetch(`${API}/api/v1/dev/inbox`)).json();
  const link = (inbox.magicLinks ?? []).filter((m: any) => m.phone === phone)[0];
  return new URL(link.link).searchParams.get("token")!;
}
