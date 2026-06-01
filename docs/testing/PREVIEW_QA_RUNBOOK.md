# Pingtally — Preview QA Runbook

> **Status:** PGS-018 — created 2026-06-01. This is the **standard, reusable process**
> for testing Vercel **Preview** builds of Pingtally before merge to `main` / production
> deploy. Run it for every release candidate so we stop rediscovering CORS, magic-link,
> session, and redirect issues each cycle.

---

## 1. Purpose

Vercel Preview builds let us validate a release candidate on a real, deployed URL before it
touches production. But the Preview frontend runs on a **`*.vercel.app`** origin while the API
stays on **`api.pingtally.com`** — a **cross-site** relationship that production
(`pingtally.com` ↔ `api.pingtally.com`, **same-site**) does not have. That difference is the
source of most Preview-only auth/CORS/cookie surprises.

This runbook is the single checklist to:
- confirm CORS, magic-link host, auth-consume, session persistence, and redirects work on a Preview;
- run the mobile + desktop viewport smoke;
- verify the page set and the approved product copy;
- make a clear **Go / No-Go** decision;
- do all of the above **without ever leaking** tokens, full magic links, full phone numbers,
  cookies, auth headers, or invite links.

> ⚠️ **Known structural constraint (read first):** a `*.vercel.app` Preview is **cross-site**
> to `api.pingtally.com`. The session cookie is `HttpOnly`, host-only to `api.pingtally.com`,
> and `SameSite=Lax`. A Lax cookie is **not sent on cross-site requests**, so an auth-gated flow
> may not complete on a bare `*.vercel.app` Preview even when every other check passes. See
> §12 No-Go and the PGS-017 notes in `docs/product/POST_GO_LIVE_STABILIZATION_PLAN.md`. If the
> auth-consume / session checks fail on a `*.vercel.app` Preview, that may be the architecture,
> not a regression — escalate rather than hacking cookies across unrelated domains.

---

## 2. Required URLs

| Role | URL |
|------|-----|
| Preview frontend | `https://<preview-branch-slug>.vercel.app` (current: `https://family-budget-web-git-qa-stabil-df5455-avi300520-1896s-projects.vercel.app`) |
| Production frontend | `https://pingtally.com` |
| Production API | `https://api.pingtally.com` |
| Auth consume route (frontend) | `https://<preview>/auth/consume?token=…` (backend endpoint it calls: `GET https://api.pingtally.com/api/v1/auth/magic-link/consume`) |
| Dashboard route | `https://<preview>/dashboard` |

> The Preview slug changes per branch/deploy. Always copy the exact current Preview origin from
> Vercel and use it verbatim everywhere below (CORS is **exact-origin** matched).

---

## 3. Required environment assumptions

Confirm **all** of these before testing — a failure here invalidates the whole run:

- **Frontend Preview env:** `NEXT_PUBLIC_API_URL = https://api.pingtally.com` (Vercel → Project →
  Settings → Environment Variables, scoped to **Preview** as well as Production). `apiBaseUrl()`
  throws at build if it is unset in a production build, so a READY Preview implies it is set —
  but confirm the **value** is the production API, not localhost or a stale host.
- **Backend CORS:** the **exact** Preview origin is allowed (exact-match `WEB_APP_URL` or the
  narrow `ALLOWED_ORIGIN_PATTERN`). The pattern must stay **exact and narrow** — never
  `*.vercel.app` or any broad wildcard — because the allowed Origin **also determines the magic
  link callback host** (see PGS-016). Broadening CORS would let unintended origins mint
  Preview-host login links.
- **Magic link callback:** links generated from the Preview must return to the **Preview** host,
  not `pingtally.com` (PGS-016 — backend uses the approved request Origin as the callback base).
- **Preview origin discipline:** keep the allowlist exact and narrow unless the owner explicitly
  approves widening it.

---

## 4. CORS check

```bash
curl -i -X OPTIONS "https://api.pingtally.com/api/v1/auth/magic-link/request" \
  -H "Origin: PREVIEW_ORIGIN_HERE" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```
Replace `PREVIEW_ORIGIN_HERE` with the exact current Preview origin.

**Expected:**
- HTTP **204** (or 200)
- `Access-Control-Allow-Origin:` equals the **exact** Preview origin (not `*`, not a different host)
- `Vary: Origin`
- `Access-Control-Allow-Methods:` includes **POST** and **OPTIONS**
- `Access-Control-Allow-Headers:` includes **Content-Type**
- (credentialed flows also expect `Access-Control-Allow-Credentials: true`)

**Negative guard (optional):** repeat with `-H "Origin: https://example.com"` → response must carry
**no** `Access-Control-Allow-Origin` header.

---

## 5. Magic Link request check (browser)

1. Open the Preview `/login`.
2. Open DevTools → **Network** and **Console**; clear both.
3. Submit a phone number (country code + local number).
4. Verify the request goes to **`https://api.pingtally.com/api/v1/auth/magic-link/request`**.
5. Verify **no CORS error** in Console.
6. Verify **no "Failed to fetch"**.
7. Confirm the success message appears (`הקישור בדרך אליכם 📩 …`).

> 🔒 Do **not** capture or paste full phone numbers. Do **not** paste full magic links or tokens.

---

## 6. Magic Link host check

When the WhatsApp magic link arrives:
- The link **host must be the Preview host** (`<preview>.vercel.app`).
- It **must NOT** be `pingtally.com` when the login was requested from the Preview.

> Record only the **host** (redacted of the token/query), e.g. "host = the Preview vercel.app
> origin ✓". Never paste the full link.

---

## 7. Auth consume check

After clicking the magic link:
- The browser **stays on the Preview domain**.
- `/auth/consume` runs and calls `GET /api/v1/auth/magic-link/consume?token=…` (one request, credentialed).
- The consume returns success (a session payload) and a `Set-Cookie` is issued.
- The user lands on **`/dashboard`** (or `/onboarding` for a new household / another approved
  internal route).
- The user is **NOT** returned to `/login`.

> ⚠️ If clicking the link lands on `/login?next=%2Fauth%2Fconsume` (or `…%2Fdashboard`), the token
> was likely **never consumed** — a route guard intercepted `/auth/consume` before the consume ran,
> or the session cookie cannot be read on the frontend origin. This is the PGS-017 failure mode;
> see §12 and the stabilization plan. Do not paste the token from the URL.

---

## 8. Session persistence check

After a successful magic-link login:
- Refresh `/dashboard` → stays authenticated.
- Open `/dashboard` directly (new tab) → stays authenticated.
- Verify **no redirect back to `/login`**.
- Verify **no "Authentication required" flash** and no error flash.

---

## 9. Viewport smoke

Run at both viewports (real browser viewport, **not** CSS simulation):
- **375 × 812** (mobile)
- **1280 × 800** (desktop)

Check for: no horizontal overflow (`document.scrollWidth === innerWidth` at 375), no overlapping
panels, route strips wrap, the `ממתין` pending pill is visible where expected.

---

## 10. Page checklist (after login)

Verify each renders (API-backed data or an intentional empty state — never fake/demo data):
- [ ] dashboard
- [ ] shopping list
- [ ] budget
- [ ] insights
- [ ] activity
- [ ] wishlists (`/family/wishlists`)
- [ ] settings
- [ ] add family member (settings → members)
- [ ] owner/admin view
- [ ] adult_member view (if a test account is available)
- [ ] limited_member view (if a test account is available) — confirm it does **not** fetch/see
      household-only endpoints (`/activity`, `/spending/*`, `/insights`, `/family/*`,
      `/category-budgets`) and `/members` returns PII-stripped fields only

---

## 11. Copy checklist

**Must NOT appear (user-facing):**
- [ ] "Dev inbox"
- [ ] a visible `/dev-inbox` link
- [ ] `עוזר הקניות המשפחתי`
- [ ] "shopping assistant" as a user-facing label
- [ ] any supermarket walking-order claim (e.g. `מסלול בסופר` / "ordered by walking order")

**Must appear (approved copy):**
- [ ] `Pingtally`
- [ ] `קופה משפחתית`
- [ ] `פחות ניהול. יותר משפחה.`
- [ ] `הוצאות, קניות, פרויקטים ובקשות מהילדים, הכל מתנהל בוואטסאפ.`

---

## 12. Go / No-Go rules

**GO only if ALL hold:**
- CORS preflight passes (§4)
- Magic link host is the Preview (§6)
- Auth consume creates a session and lands on `/dashboard` (§7)
- `/dashboard` works (and persists) after login (§8)
- Mobile (375) and desktop (1280) smoke pass (§9)
- No blocked/old copy; approved copy present (§11)
- No visible dev tooling or dev wording

**NO-GO if ANY hold:**
- "Failed to fetch"
- CORS failure
- Magic link returns to **production** (`pingtally.com`) when requested from Preview
- Clicking the magic link returns to `/login`
- `/dashboard` redirects to `/login` **after** a successful magic-link login
- Mobile horizontal overflow
- "Dev inbox" visible
- Old product framing visible

> **Cross-site caveat:** if auth-consume/session **fail specifically on a `*.vercel.app`
> Preview** while CORS and magic-link host pass, suspect the cross-site cookie constraint (§1),
> not a code regression. Escalate to the owner with the architecture options (same-site Preview
> host, proxy, or a deliberate cookie-policy decision) — do **not** loosen the production cookie
> or broaden CORS to force it through.

---

## 13. Evidence rules

**Never paste / store:**
- token
- full magic link
- full phone number
- cookies
- auth headers
- invite links
- `DATABASE_URL`, Supabase keys, WhatsApp tokens

**Allowed evidence:**
- redacted URL **host** only (e.g. "host = the Preview origin")
- HTTP status codes
- header **names** (and non-secret values like `Vary: Origin`, `Allow-Methods`)
- a screenshot with the **token and phone number blurred/redacted**

---

### Quick reference — one-line pass criteria
CORS 204 + exact ACAO → magic-link host = Preview → click stays on Preview → `/auth/consume`
consumes (Set-Cookie) → `/dashboard` loads and persists → 375 + 1280 clean → approved copy only.
Any deviation → No-Go (and check the cross-site caveat before filing a code bug).

---

## Authenticated Preview Testing Requires a Same-Site QA Hostname (PGS-017B)

**Bottom line:** a `*.vercel.app` Preview is only reliable for **public / unauthenticated page
smoke** (layout, copy, empty states, CORS preflight, magic-link host). **Authenticated** app smoke
(consume → session → `/dashboard` → persistence) must be run against a **same-site QA hostname**
under `pingtally.com`, e.g. **`qa.pingtally.com`** (or `staging.pingtally.com`).

### Why `*.vercel.app` cannot hold an authenticated session

- The session cookie is set by the backend on **`api.pingtally.com`**, `HttpOnly`, **host-only**,
  `SameSite=Lax`, `Secure`.
- `SameSite=Lax` cookies are **only sent on same-site requests**. `*.vercel.app` and
  `api.pingtally.com` are **different registrable domains → cross-site**, so the cookie is **not
  sent** on the Preview's credentialed `/me`/API calls (and a cross-site response cookie isn't
  reliably usable either). Result: even after a correct `/auth/consume`, the app reads no session.
- `qa.pingtally.com` ↔ `api.pingtally.com` are **subdomains of the same registrable domain
  (`pingtally.com`) → same-site**, so the **existing** `SameSite=Lax` cookie works there **with no
  change to backend cookie security**. Production (`pingtally.com`) works for exactly this reason.

### What NOT to do (security)
- ❌ **No `SameSite=None`** for this release (would send the cookie on all cross-site requests;
  CSRF-posture change — needs a dedicated security review).
- ❌ **No wildcard / broad CORS** and **no broad `*.vercel.app`** in `ALLOWED_ORIGIN_PATTERN` — the
  allowed Origin also mints the magic-link callback host (PGS-016), so it must stay exact.
- ❌ **No `Domain=.pingtally.com` cookie hack** or any cross-unrelated-domain cookie sharing without
  a deliberate design + security review.
- ❌ **No client-supplied `callbackUrl`/`redirectUrl`** trusted by the backend.
- ❌ **No manual token editing**, and never log magic tokens.

### QA-domain setup — stable `qa` branch model

**Branch model (DONE):** the permanent QA channel is the stable **`qa`** branch (origin `qa` →
`0bac8ec`, carrying PGS-017A + PGS-018). The former temporary integration branch was renamed to
**`release/stabilization-product-copy-integration`** (same commit `0bac8ec`) to free the `qa` name;
the old `qa/stabilization-product-copy-integration` remote branch was removed. Release candidates are
merged/fast-forwarded into `qa`, and `qa.pingtally.com` is assigned to the `qa` branch in Vercel.

**Remaining steps — owner dashboard actions (NOT performed by the agent; no connector tool exists):**

1. **QA domain:** `qa.pingtally.com`.
2. **Vercel (owner):** in the frontend project, add `qa.pingtally.com` and **assign it to the `qa`
   Git branch** (Preview branch domain — NOT Production). Confirm the **Preview** env scope has
   **`NEXT_PUBLIC_API_URL = https://api.pingtally.com`** (Settings → Environment Variables → Preview).
3. **Cloudflare DNS (owner):** add **only** the new `qa` record using the **exact CNAME target Vercel
   displays** (typically `cname.vercel-dns.com`, matching the existing `www`). **DNS-only (grey
   cloud)** unless Vercel explicitly accepts the proxied setup. **Do NOT change** `pingtally.com`,
   `www.pingtally.com`, or `api.pingtally.com`.

**Backend allowlist — agent will run AFTER the domain is live (env-only, exact origin):**

4. Set the prod backend `ALLOWED_ORIGIN_PATTERN` to the **exact** QA origin and reload:
   `ALLOWED_ORIGIN_PATTERN=^https://qa\.pingtally\.com$` → `pm2 reload pingtally-api --update-env`.
   (The previous exact vercel-preview origin is already defunct — its branch was deleted — so no
   transition alternation is needed; go straight to QA-only.) This passes CORS **and** makes magic
   links requested from `qa.pingtally.com` return to `qa.pingtally.com/auth/consume` automatically
   (PGS-016 uses the approved request Origin as the callback base). **No wildcard, no `*.vercel.app`.**
5. **Magic-link behavior (automatic):** login from `qa.pingtally.com` → link host `qa.pingtally.com`;
   login from `pingtally.com` → link host `pingtally.com` (unchanged).
6. **Then run the full §1–§13 runbook against `qa.pingtally.com`** — including the authenticated
   checks (§7 consume, §8 persistence) which now pass because the domain is same-site with the API.

### Smoke tests to run on the QA domain (after setup)
CORS preflight (Origin `https://qa.pingtally.com`) → request magic link from QA → WhatsApp link host
= QA domain → click → browser stays on QA domain → `/dashboard` loads → refresh `/dashboard` still
authenticated → 375×812 + 1280×800 clean.
