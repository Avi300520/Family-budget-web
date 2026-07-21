# BATCH-GH accessibility verification harness

Runs the automatable half of
`Shopping assistant/docs/audit/2026-07-06/ACCESSIBILITY_PHYSICAL_AUDIT_CHECKLIST_HE.md`
against the **8 public routes in their REAL states**, in **Chromium and WebKit**, with the
**accessibility menu opened and each mode engaged**.

Findings live in the backend repo:
`docs/audit/2026-07-06/ACCESSIBILITY_PLAYWRIGHT_REPORT.md` (+ `evidence-batch-gh-playwright/`).

**This is verification, not a gate.** It is not wired into CI and it changes nothing in the app.
`pnpm a11y` at the repo root remains the committed scan; this harness is the deeper, slower pass
that needs a live backend.

## Why it is not in the workspace

`pnpm-workspace.yaml` globs `apps/*` (direct children only), so this nested `package.json` is
inert. Its dependencies are deliberately **not** in the repo lockfile: Vercel installs with
`--frozen-lockfile`, and a committed Playwright dependency would download Chromium on every
production build. Install on demand.

## Running it

```bash
# 1. backend: memory store, share links armed, CORS for localhost:3000
NODE_ENV=development API_PORT=4100 WEB_APP_URL=http://localhost:3000 \
STORE_PROVIDER=memory WHATSAPP_PROVIDER=mock COOKIE_SECURE= \
SHOPPING_WEB_LIST_ENABLED=true SHOPPING_COMPLETION_NUDGE_ENABLED=true \
pnpm --filter @shopping-assistant/api start

# 2. frontend: PRODUCTION build pointed at it (NEXT_PUBLIC_* is baked at build time)
cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:4100 pnpm build && pnpm start

# 3. here
npm install
npx playwright install chromium webkit
npx playwright test          # globalSetup re-seeds every real state first
node digest.mjs              # readable roll-up of evidence/results.ndjson
node debug-skiplink.mjs      # measures both skip links in their FOCUSED state (defect D1)
```

## What it covers

| Spec | Checklist § |
|---|---|
| `axe.spec.ts` | axe `wcag2a`+`wcag2aa` per route-state **× 7 accessibility-menu modes** |
| `structure.spec.ts` | one `h1` / one `main#main`, heading order, list semantics, 2.5.3 label-in-name, form labels, Chromium AX tree via CDP |
| `keyboard.spec.ts` | Tab walk with computed focus indicators, trap detection, menu Escape/non-modal behaviour, focus retention after every `/l` action |
| `visual.spec.ts` | measured contrast (**all modes**), reflow at 320/640/320 px, menu font-scaling, launcher-vs-sticky-CTA geometry, motion, colour-not-alone |
| `forms.spec.ts` | error announcement + association, `/auth/consume` success branch |

`seed-all.mjs` drives the real API into every state: `/l` active · mixed (partial 5/9 + חסר +
bought) · completed/locked · invalid; a real `/join` invite; an authenticated `/onboarding` wizard.

## Two traps that produced false results before being fixed

* **Share tokens live 4 hours.** A long run outlived them and silently turned `/l` scans into
  error-state scans — which looked like a WebKit-only `/l` failure. `globalSetup` now re-seeds, and
  every `/l` target carries a `marker` regex that `open()` asserts, so a dead token fails loudly.
* **`button[aria-pressed]` also matches the *closed* accessibility panel's toggles**, which precede
  the page content in DOM order (`A11yBar` is the first child of `<body>`). Scope to `main`.

## Honesty rules baked in

* Playwright reads the DOM, computed styles, geometry and focus. It does **not** voice a screen
  reader, drive voice-control software, or use a touch device. Those stay NEEDS-HUMAN.
* axe `incomplete` results are recorded but **never** counted as passes.
* Contrast samples sitting on a `background-image`/gradient are reported as **undetermined**, never
  as passes or failures — there is no single computable backdrop.
* Contrast composites ancestor backgrounds **and cumulative `opacity`** — `opacity` on a row is a
  contrast bug (CLAUDE.md), and a naive `color`-vs-`background-color` read misses it.
* WebKit here is Playwright's build, **not Safari**. Its keyboard defaults differ (links are not in
  the Tab order) and it exposes no accessibility tree, so engine-specific AT behaviour is reported
  as an observation, never as a pass or a site defect.
