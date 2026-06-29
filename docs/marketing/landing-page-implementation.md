# Public Root Landing — Implementation Notes

Branch: `feat/public-root-landing-pingtally` (off `main`). Makes `https://pingtally.com/`
the public, indexable Pingtally marketing page (SSR/SSG), replacing the old
`/` → `/dashboard` redirect. The proven WhatsApp magic-link flow is preserved.

## Architecture

- **`/` (`app/page.tsx`)** — server component, owns canonical `/` + full metadata,
  renders `<MarketingLanding/>` as static HTML (`○ Static` in the build). No server
  redirect → crawlers and logged-out users always get the full marketing HTML.
- **`/login` (`app/login/page.tsx`)** — renders the **same** `<MarketingLanding/>`,
  `canonical → /`, excluded from the sitemap. This preserves the auth-guard contract
  exactly: `redirectIfUnauthorized()` sends 401s to `/login?next=<path>`, and the hero
  form reads `?next=` from `window.location.search` at submit (keeping the page static).
- **`MarketingLanding`** (`components/marketing/MarketingLanding.tsx`) — server
  component composing 13 sections; interactive bits are small client islands:
  - `LandingNav` (burger; stays at 320px), `MagicLinkForm` (hero + final CTA),
    `PricingPlans` (monthly/yearly toggle), `LandingFaq` (tablist + accordion).
  - `HeroVisual`, `PingtallyMark/Lockup`, `LandingJsonLd` are server/presentational.
- **CSS** — `styles/marketing.css`, a self-contained `.pt-*` system with the design's
  refined tokens scoped to `.pt-root` (deep-teal ink `#11231F`, AA-safe `--text-2`,
  larger radii) so the dashboard's global `tokens.css` is untouched. Imported by
  `MarketingLanding` (scoped to the landing routes, not global). FAQ accordion uses
  `grid-template-rows 0fr→1fr` (no layout-property animation, no max-height clip). The
  old `.home-*` landing block was removed from `globals.css`.
- **Reuse, not rewrite** — the real `api.requestMagicLink`, the 199-country
  `PhoneInput`, and `lib/countryCodes` are reused as-is. No auth rewrite, no new deps,
  no backend changes.

## SEO

- `app/layout.tsx`: `metadataBase https://pingtally.com`, canonical title/description,
  OpenGraph (`website`, siteName, `he_IL`, 1200×630 image) + Twitter `summary_large_image`
  + `theme-color #0F766E`. No `title.template` (legal pages keep their own titles).
- `app/robots.ts` — allow public, disallow every authenticated route, sitemap pointer.
- `app/sitemap.ts` — `/`, `/privacy`, `/terms` only (`/login` excluded).
- `app/manifest.ts` — PWA manifest (he/rtl, theme/background colour, 512 icon).
- Icons/OG: `public/og-pingtally.png` (1200×630), `public/pingtally-icon.png` (512,
  schema/manifest), `app/icon.png` + `app/apple-icon.png` (Next conventions). All
  sourced from the owner-review package.
- JSON-LD (`LandingJsonLd`): Organization + WebSite + SoftwareApplication
  (`alternateName "קופה משפחתית"`, FinanceApplication, AggregateOffer over the 3 tiers)
  + FAQPage (12 curated items). No HowTo / reviews / ratings / certifications.

## Copy safety

Canonical, safety-corrected copy lives in the components; governance in
`docs/marketing/CLAIMS_ALLOWLIST.md`. The landing **fixes** several issues that were
live on the old `/login`: the forbidden `נזכיר לפני כל חיוב` (gone), `10 דקות`→`15 דקות`,
unscoped `אוטומטית`, unscoped `תמונה מלאה`, and the old `קופה משפחתית` brand + `ק` mark
(now the Pingtally wordmark + chat-bubble/tally mark). Because `/login` renders the same
component, **this also corrects production `/login`.**

## Pricing sync (IMPORTANT)

Tier prices are hardcoded in **`PricingPlans.tsx`** and the offers in
**`LandingJsonLd.tsx`** so `/` stays static/crawlable (no runtime `/plans` fetch). They
mirror the backend `PLAN_PRICEBOOK` (1990/2990/3990 monthly, 19900/29900/39900 yearly
agorot). **A price change is a backend deploy AND an edit in both files.**

## Authenticated-user path

No auto-redirect from `/` (would cost an `/me` round-trip + flash, and the session
cookie is HttpOnly/cross-origin so it can't be read client-side). Instead the footer
"כניסה לחשבון" links to `/dashboard` — authenticated users land on their dashboard;
logged-out users hit the client guard and bounce back to the landing form. No loading
wall at `/`.

## Follow-ups (not in this PR)

- Align the live WhatsApp bot to the "פינג" persona; add safe first-name personalization.
- Optional: source prices from `/plans` at build time if the static-resilience tradeoff
  changes.
- `favicon.ico` is not shipped (Next serves `app/icon.png` + `<link rel=icon>`); add a
  real `.ico` if a crawler that only requests `/favicon.ico` matters.

## Gate results (local)

typecheck ✅ · web unit tests 62/62 ✅ (incl. noEmDash + brandCopy) · production build ✅
(30 routes; `/` and `/login` both `○ Static`) · blocked-claim grep ✅ 0 hits ·
prerendered HTML carries H1 + all 11 section anchors + all 29 FAQ Q&A + canonical + OG +
6 JSON-LD types. Real-viewport a11y/responsive smoke + claude-seo + impeccable: see PR.
