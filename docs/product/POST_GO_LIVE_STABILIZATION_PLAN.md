# Pingtally — Post Go-Live Stabilization Plan

**Status:** Active — Stabilization Cycle 1
**Created:** 2026-05-31
**Domain:** pingtally.com (unchanged — no domain rename)
**Repos:** Avi300520/Family-budget · Avi300520/Family-budget-web
**Live product:** https://pingtally.com · API: https://api.pingtally.com

---

## 1. Executive Summary

Pingtally is live. The first real-user household is registered and the WhatsApp →
backend → web-dashboard flow is verified end-to-end. This document governs the first
post-go-live stabilization cycle — the transition from "deployed and working" to
"comfortable and trustworthy for new households."

The stabilization cycle has three goals:

1. **Fix P0/P1 UX defects** that block comfortable first-use: mobile layout, auth
   redirect, phone input, and developer artifacts visible in production UI.
2. **Establish clean product language** — inventory all visible strings, agree on
   approved copy, then implement in one focused release.
3. **Strengthen WhatsApp onboarding** — the bot's first messages set the product's
   tone; they need to be warm, clear, and role-appropriate.

This is NOT a feature cycle. No new backend endpoints, no migrations, no NLP behavior
changes, no admin deployment. Every change is measured against: "does this make the
first-time household experience trustworthy and clear?"

---

## 2. Product Definition Working Draft

### 2a. Current Framing Problem

The product is currently described and identified in two narrow ways:
- Frontend header: "עוזר הקניות המשפחתי" (the family shopping assistant)
- Browser title: "קופה משפחתית" (family till/checkout)
- Backend first WhatsApp message: "ברוכים הבאים לעוזר הקניות המשפחתי!"

These labels undersell the actual surface area, which also covers:
projects (summer holidays, bar mitzvah, renovation), child/teen allowances and wishlists,
family insights (weekly wrapped, category caps, activity heatmaps), spending breakdowns,
and household coordination.

### 2b. Recommended Broader Framing

**Pingtally is a WhatsApp-first family home-management assistant for money, shopping,
projects, children, and day-to-day family coordination.**

Keep **Pingtally** as the brand. Replace the narrow "shopping assistant" and "family
till" framing with copy that reflects this broader scope. The Hebrew tagline can be
refined once the owner approves a direction from the options below.

**What stays unchanged — no rename:**
- Domain: `pingtally.com` — no domain rename
- Brand name: `Pingtally`
- Repository names, package names, env var names, database table names, backend services
- All technical identifiers internal to the codebase

**What is open for change (visible app text and copy only):**
- Frontend header brand label
- Browser `<title>` and `<meta description>`
- Login page copy
- WhatsApp onboarding messages

### 2c. Hebrew Product Description Options (3–5 for owner decision)

| # | Hebrew | Tone |
|---|--------|------|
| 1 | קופה משפחתית — ניהול תקציב חכם דרך וואטסאפ | Current, functional |
| 2 | ניהול הבית — הוצאות, קנייה, פרויקטים וכיס לילדים בוואטסאפ | Comprehensive, feature-list |
| 3 | הכסף שלנו — שלח הודעה, אנחנו נדאג לשאר | Warm, value-first |
| 4 | פינגטלי — ניהול כסף וקניות משפחתי דרך וואטסאפ | Brand-forward |
| 5 | כמו לדבר עם בן משפחה חכם — תקציב, קניות ופרויקטים בוואטסאפ | Metaphor-driven (from product north-star) |

### 2d. English Product Description Options (3–5 options)

| # | English | Tone |
|---|---------|------|
| 1 | Family budget manager via WhatsApp | Current, minimal |
| 2 | WhatsApp-first family finance for Israeli households | Targeted |
| 3 | Track your family's money the way you talk — just send a message | Conversational |
| 4 | Pingtally: expenses, shopping, projects, and kids' allowances — all in WhatsApp | Feature-complete |
| 5 | One chat, your whole family's finances | Punchy |

### 2e. Naming: Pingtally vs. קופה משפחתית

| Dimension | Pingtally | קופה משפחתית |
|-----------|-----------|--------------|
| Domain/brand | pingtally.com (live, fixed) | Hebrew display/tagline |
| Register | Tech brand, global-capable | Warm, Hebrew-native |
| Metaphor | Ping (alert) + tally (count) | Family till/checkout |
| Risk | No Hebrew meaning | "קופה" = supermarket checkout; may feel narrow |
| Recommendation | Keep as the brand identifier | Use as tagline; open for revision |

These coexist: **Pingtally** as brand, a revised Hebrew tagline as the concept.
The "קופה" question is worth revisiting once a broader tagline direction is approved.

### 2f. Open Decision Points for Owner (Required Before PGS-007B Implementation)

1. Approve one Hebrew description from section 2c (needed for header, title, WhatsApp messages)
2. Is the product Hebrew-only / Israel-only for the immediate roadmap?
3. Approve WhatsApp first-contact message draft (PGS-008)
4. Approve post-household-setup message draft (PGS-009)
5. Approve role-based welcome message drafts for admin, adult_member, limited_member (PGS-010)

*Note: Owner observations have been provided and summarized into PGS-001 through PGS-010.
If the original observations document is needed for additional detail, owner can share its
path at any time — this is not blocking planning or stabilization-1 implementation.*

---

## 3. Git and Release Management Plan

### 3a. Current Repository State

| Property | Backend | Frontend |
|----------|---------|----------|
| Current branch | `release/final-predeploy-remediation` | `main` |
| Version | `0.1.0` (all packages) | `0.1.0` |
| Tags | None | None |
| Release model | Branch-based, release/* → main | Same |
| Production commit | `d3a4bb7` (Hetzner deployed) | `d356c97` (Vercel) |

No semantic version tags exist. Introducing lightweight production tags after each
successful deploy: format `v0.1.x-release-name`.

### 3b. Proposed Branch Structure

```
main                                   <- production only; fast-forward merges
  |
  +-- plan/post-go-live-stabilization  <- docs only (this file + copy registry)
  |
  +-- release/stabilization-1          <- PGS-001 through PGS-006
  |     +-- fix/pgs-001-mobile-layout
  |     +-- fix/pgs-002-auth-redirect
  |     +-- fix/pgs-003-dev-inbox-text
  |     +-- fix/pgs-004-magic-link-success
  |     +-- fix/pgs-005-phone-input-login
  |     +-- fix/pgs-006-phone-input-member
  |
  +-- release/product-copy-1           <- PGS-007A, 007B, 008, 009, 010
  |     +-- chore/pgs-007a-copy-inventory
  |     +-- chore/pgs-007b-copy-implement  (after owner approval only)
  |     +-- chore/pgs-008-010-whatsapp-copy
  |
  +-- release/nlp-1                    <- after stabilization-1 + product-copy-1 merged
```

Task branches: `fix/pgs-NNN-slug` for code fixes, `chore/pgs-NNN-slug` for copy/docs.

### 3c. Rules

1. No direct commits to `main`.
2. Every task branch requires acceptance criteria before implementation starts.
3. Task branches merge to the relevant release branch (not directly to main).
4. Release branch merges to `main` only after: owner review + `pnpm test` + `pnpm typecheck` + `pnpm build` green + Vercel preview smoke.
5. Production tags are created after deploy confirmation: `v0.1.1-stabilization-1`, etc.
6. Both repos advance in lockstep when shared types/api-client change. Run `pnpm sync:shared`.
7. No `git push --force` to `main`.
8. `CLAUDE.md` (backend) is the single source of truth for the release ledger.

---

## 4. Issue Registry

| ID | Title | Repo | Priority |
|----|-------|------|----------|
| PGS-001 | Mobile layout broken | Frontend | P1 |
| PGS-002 | Unauthenticated direct entry shows "Authentication required" | Frontend | P1 |
| PGS-003 | "Dev inbox" text visible in production login UI | Frontend | P1 |
| PGS-004 | No clear success message after WhatsApp magic link sent | Frontend | P2 |
| PGS-005 | Phone input broken on login page | Frontend | P1 |
| PGS-006 | Phone input broken on add household member | Frontend | P2 |
| PGS-007A | Product language inventory — search and classify all visible strings | Both | P2 |
| PGS-007B | Approved copy implementation — replace strings after owner approval | Both | P2 |
| PGS-008 | First WhatsApp welcome message unclear; uses narrow product framing | Backend | P2 |
| PGS-009 | Post household setup WhatsApp guidance terse and unclear | Backend | P2 |
| PGS-010 | Role-based onboarding copy missing for admin, adult_member, limited_member | Backend | P3 |

---

## 5. Classification

| ID | Category | Severity | Rationale |
|----|----------|----------|-----------|
| PGS-001 | Stabilization | P1 | Most users access on mobile; broken layout blocks use |
| PGS-002 | Stabilization | P1 | Confusing UX; user sees error instead of clean login redirect |
| PGS-003 | UX + Security hardening | P1 | Dev text in production erodes trust; straightforward to fix |
| PGS-004 | Stabilization | P2 | Poor feedback; user unsure if magic link was sent |
| PGS-005 | Stabilization | P1 | Login impossible if phone input is broken |
| PGS-006 | Stabilization | P2 | Member invite painful; workarounds exist |
| PGS-007A | Product iteration | P2 | Precondition for PGS-007B and PGS-008 through PGS-010 |
| PGS-007B | Product iteration | P2 | Implement only after owner approves copy |
| PGS-008 | Product iteration | P2 | First impression via WhatsApp; critical but correctable |
| PGS-009 | Product iteration | P2 | Onboarding drop-off risk; correctable |
| PGS-010 | Product iteration | P3 | Polish; admin/adult scenarios less common initially |

**Severity definitions:**
- P0: Production incident — product is down or data corrupted
- P1: Must fix before wider use — blocks comfortable first use
- P2: Should fix in stabilization — degrades experience, workarounds exist
- P3: Backlog — quality improvement, not blocking

---

## 6. Recommended Release Packaging

### Package 1: `release/stabilization-1`
- **Scope:** PGS-001, PGS-002, PGS-003, PGS-004, PGS-005, PGS-006
- **Gate:** `pnpm test && pnpm typecheck && pnpm build` green + Vercel preview smoke (375x812 + 1280px)
- **Tag after deploy:** `v0.1.1-stabilization-1`
- **Backend changes:** none unless PGS-003 requires server-side dev-route gating

### Package 2: `release/product-copy-1`
- **Scope:** PGS-007A (inventory), owner approval gate, then PGS-007B + PGS-008 + PGS-009 + PGS-010
- **Dependency:** Owner approves copy from section 2c/2d + WhatsApp message drafts
- **Gate:** Owner approval of all copy + `pnpm test` green + smoke
- **Tag after deploy:** `v0.1.2-product-copy-1`

### Package 3: `release/nlp-1`
- **Scope:** NLP behavior improvements (TBD from real-user feedback)
- **Dependency:** Packages 1 and 2 deployed and stable
- **Gate:** Full backend test suite + owner sign-off on NLP change set

---

## 7. Acceptance Criteria Per Issue

### PGS-001 — Mobile layout
- [ ] App shell fits 375x812 without horizontal overflow (document.scrollWidth === 375)
- [ ] Navigation reachable on mobile
- [ ] No fixed-width elements break layout below 375px
- [ ] Verified with real Playwright 375x812 viewport (not CSS simulation)
- [ ] Existing 1280px layout unchanged

### PGS-002 — Auth redirect
- [ ] Direct navigate to /dashboard without session redirects to /login
- [ ] No flash of "Authentication required" text visible to user
- [ ] After login, user returns to originally-requested URL or dashboard default
- [ ] Authenticated user visiting /login redirected to dashboard

### PGS-003 — Dev inbox text
- [ ] No "Dev inbox" link, button, or text on login page or anywhere in production UI
- [ ] "קישור נשלח ל-Dev inbox" status replaced with clear Hebrew production message
- [ ] "פתיחת Dev inbox" link removed from login page
- [ ] Rendered production HTML: no "dev" / "inbox" / "Dev inbox" visible to users
- [ ] The nginx /api/v1/dev/* 403 block is unaffected (frontend-only change)

### PGS-004 — Magic link success message
- [ ] After valid phone submission: clear Hebrew success message shown
  (e.g. "שלחנו לך קישור לוואטסאפ — לחץ עליו כדי להיכנס")
- [ ] Message is visible and does not disappear immediately
- [ ] Server error shows a clear Hebrew error message, not a raw error object
- [ ] Submit button disabled after successful submission (prevents double-send)

### PGS-005 — Phone input on login
- [ ] Searchable country code selector + separate phone number field
- [ ] Default: Israel (+972) pre-selected
- [ ] Number field: digits only, strips leading 0 (052 becomes 52, Israeli convention)
- [ ] Full E.164 number assembled and submitted to API
- [ ] Phone number field has dir="ltr"
- [ ] Works on mobile numeric keyboard

### PGS-006 — Phone input on add member
- [ ] Same phone input component as PGS-005
- [ ] Same acceptance criteria as PGS-005
- [ ] Existing member management flows not regressed

### PGS-007A — Product language inventory
- [ ] COPY_AND_MESSAGING_REGISTRY.md complete with every visible string
- [ ] Covers: frontend header, browser title/description, login page, dashboard, nav labels,
  empty states, error messages, WhatsApp messages, onboarding flows
- [ ] Each entry has: current text, file + line, context, problem flag, owner approval field
- [ ] Classification: frontend UI / browser metadata / WhatsApp message / admin-only / dev-only
- [ ] Searches completed for: עוזר הקניות המשפחתי, עוזר הקניות, קופה משפחתית, Pingtally,
  shopping assistant, family budget, Authentication required, Dev inbox

### PGS-007B — Approved copy implementation
- [ ] Owner has approved each string in COPY_AND_MESSAGING_REGISTRY.md before implementation
- [ ] All approved strings replaced in their canonical files
- [ ] No "עוזר הקניות המשפחתי" visible in production UI header
- [ ] Browser title and description updated per approved copy
- [ ] No "shopping assistant" label in user-facing copy
- [ ] Hebrew strings in backend remain in messages.ts only (no new inline violations)

### PGS-008 — First WhatsApp welcome message
- [ ] Clearly explains what the product does in one warm sentence
- [ ] Gives at least 2 examples of what to send (expense + shopping item)
- [ ] Mentions help command
- [ ] Message ≤ 5 lines
- [ ] Owner approved before backend deploy

### PGS-009 — Post household setup WhatsApp guidance
- [ ] Confirms household is ready
- [ ] Offers a short path (example: send "55 סופר" to log first expense)
- [ ] Mentions web dashboard link
- [ ] Message ≤ 5 lines
- [ ] Owner approved before backend deploy

### PGS-010 — Role-based onboarding
- [ ] admin: message clarifies scope vs owner
- [ ] adult_member: explains household vs personal expense logging
- [ ] limited_member: warm, age-appropriate, explains personal budget and wishlist
- [ ] All messages ≤ 5 lines each
- [ ] All Hebrew strings in messages.ts only
- [ ] Owner approved before deploy

---

## 8. Testing Plan

### Automated checks (every task branch)

```bash
# Backend (C:\Users\avrahamm\Desktop\Shopping assistant)
pnpm test           # 201 tests must pass
pnpm typecheck

# Frontend (C:\Users\avrahamm\Desktop\Family-budget-web)
pnpm typecheck
pnpm build          # all 24 routes must build clean
```

### Browser smoke (before release branch merge to main)

| Viewport | Checks |
|----------|--------|
| 375x812 Chrome | No horizontal overflow, nav reachable, login flow completes, Hebrew RTL renders |
| 375x812 Safari (if available) | Same |
| 1280x800 Chrome | Dashboard, shopping list, settings, category-budget progress bars, insights |

### Auth flow test matrix

| Scenario | Expected |
|----------|----------|
| Direct navigate to /dashboard without session | Redirect to /login |
| Submit valid phone | Hebrew success message; button disabled |
| Submit invalid phone | Hebrew error; no crash |
| Open magic link from WhatsApp | Auth succeeds; lands on dashboard |
| Authenticated user visits /login | Redirect to dashboard |

### Copy QA (PGS-007B through PGS-010)

- [ ] No "עוזר הקניות המשפחתי" in production header after PGS-007B
- [ ] No "Dev inbox" text anywhere in production UI
- [ ] Browser title updated per approved copy
- [ ] WhatsApp message drafts owner-approved before backend deploy
- [ ] Hebrew renders naturally in RTL layout

### Safety rules for all testing

- No secrets printed in test output or docs
- No full phone numbers in any file
- No DATABASE_URL, WhatsApp tokens, magic links, auth headers, invite links printed

---

## 9. What NOT to Do in This Stabilization Cycle

- No NLP fixes — deferred to release/nlp-1
- No admin dashboard deployment — stays local-only per ADMIN_DASHBOARD_PLAN.md
- No new migrations — migration 0021 exists but is an operator action
- No Cloudflare changes
- No nginx changes
- No WhatsApp production configuration changes
- No backend secrets in frontend env
- No full phone numbers, tokens, cookies, magic links, auth headers, or invite links
  written into docs, logs, screenshots, or commits
- Do not treat RTL rendering as a bug unless the actual live site shows broken RTL
- Do not rename repositories, packages, env vars, or database tables without explicit owner approval

---

## 10. Recommended First Implementation Agent

**Agent name:** Frontend Mobile/Auth Stabilization Agent

Paste this prompt to start the first implementation:

---

Task complexity: Medium.

You are the Frontend Mobile/Auth Stabilization Agent for Pingtally.

Your job is to implement and verify fixes for PGS-001 through PGS-006 only.
Do NOT touch NLP, backend business logic, migrations, admin, nginx, Cloudflare, or WhatsApp config.
Do NOT deploy to production. Do NOT change backend secrets.
Do NOT print secrets, phone numbers, tokens, or auth headers.

Context files to read before starting:
1. C:\Users\avrahamm\Desktop\Shopping assistant\CLAUDE.md
2. C:\Users\avrahamm\Desktop\Family-budget-web\docs\product\POST_GO_LIVE_STABILIZATION_PLAN.md (section 7 — acceptance criteria)
3. C:\Users\avrahamm\Desktop\Family-budget-web\docs\product\COPY_AND_MESSAGING_REGISTRY.md (string locations)
4. C:\Users\avrahamm\Desktop\Family-budget-web\docs\deployment\VERCEL_DEPLOYMENT_PLAN.md

Working directory: C:\Users\avrahamm\Desktop\Family-budget-web

Starting branch: create release/stabilization-1 from main if it does not exist;
create fix/pgs-NNN-slug task branches from that release branch.

Issues in priority order:
  PGS-001 — Mobile layout (P1)
  PGS-002 — Auth redirect (P1)
  PGS-003 — Dev inbox text removal (P1)
    Key files: apps/web/src/app/login/page.tsx lines 19 and 41
  PGS-005 — Phone input on login (P1)
  PGS-004 — Magic link success message (P2)
  PGS-006 — Phone input on add member (P2)

Required commands before reporting done:
  pnpm typecheck    (from Family-budget-web root)
  pnpm build        (from Family-budget-web root)

Do NOT run pnpm test — tests live in the backend repo.
Do NOT run migrations. Do NOT modify apps/api or packages/db.
Do NOT change the brand name or browser title — those are PGS-007B; owner approval required first.

At the end:
1. Append a fix summary to "Active Development Status" in CLAUDE.md (backend repo)
2. Update VERCEL_DEPLOYMENT_PLAN.md with verification results
3. Report: branch name, files changed, build result, Vercel preview URL, open questions

---

---

## Approved Copy Decision (2026-05-31)

**Brand:** Pingtally
**Short Hebrew display name:** קופה משפחתית
**Main slogan:** פחות ניהול. יותר משפחה.
**Supporting sentence:** הוצאות, קניות, פרויקטים ובקשות מהילדים, הכל מתנהל בוואטסאפ.

**Implementation status:**

| Branch | Scope | Build | Pushed |
|--------|-------|-------|--------|
| `release/stabilization-1` (frontend) | PGS-001–005 | ✅ clean | ✅ |
| `release/product-copy-1` (frontend) | PGS-007B | ✅ clean | ✅ |
| `chore/pgs-008-010-whatsapp-copy` (backend) | PGS-008–010 | typecheck clean | ✅ |

**Pre-existing test failures in backend (18/237) — confirmed not caused by copy changes.
Same 18 failures present before and after messages.ts edits (verified via git stash).**

---

## Integration & Release-Gate QA (2026-05-31 — Release Integration & QA Orchestrator)

**Integration branch (frontend):** `qa/stabilization-product-copy-integration`
(based on `release/stabilization-1`, merged `release/product-copy-1`).

**Merge result:** single conflict in `apps/web/src/app/login/page.tsx` (both release
branches edited it). Resolved by keeping stabilization-1's phone-input model
(country-code selector +972 default, `normalizePhone` leading-0 strip, `Suspense` +
`next` param, button lockout after success) and adopting product-copy-1's approved copy
(hero `פחות ניהול. יותר משפחה.`, login title `נכנסים דרך וואטסאפ`, success message
`הקישור בדרך אליכם 📩 פתחו את וואטסאפ והיכנסו בלחיצה.`, button label `שליחת קישור כניסה`).
All other product-copy files (layout, AppShell, dashboard, shopping-list, settings/members)
merged cleanly. **Frontend typecheck + build clean: 24 routes + middleware (34 kB).**
Forbidden-string scan clean (no user-facing `עוזר הקניות` / `Dev inbox` / `/dev-inbox` /
`shopping assistant` / `Authentication required`). Nav links all map to existing routes
(no phantom פרויקטים/משפחה entries).

**Backend (`chore/pgs-008-010-whatsapp-copy`):** approved onboarding/welcome/help copy
verified present and consistent. Typecheck clean; suite **18 failed / 219 passed (237)** =
identical to pre-edit baseline (18 pre-existing, environment-dependent). Copy edits added
zero failures.

### PGS-011 (NEW — follow-up) — Wire a real "tour"/full-explanation flow

The approved copy promised `שלחו 1` for a product tour, but it was **structurally
unwireable** before deploy: no tour message exists; a bare `1` is overloaded (approval /
project nudge / expense-type choice); and the most visible promise lived in the
pre-onboarding `onboardingInvitationMessage`, where an inbound `1` only re-sends the
invitation (`apps/api/src/server.ts:1258-1291`). **Resolution shipped on
`chore/pgs-008-010-whatsapp-copy`:** the `שלחו 1` promise was removed from the owner
welcome, `onboardingCompletedMessage`, and `onboardingInvitationMessage` (legitimate wired
`שלח 1` approval/project prompts kept). All remaining copy points only to `כתבו עזרה`,
which IS wired (`server.ts:1595`). **PGS-011** tracks designing + wiring a genuine product
tour (incl. the pre-onboarding context), as a follow-up branch.

### Release-gate status

| Gate | Result |
|------|--------|
| Frontend integration (stabilization + product-copy) | ✅ clean merge (1 resolved conflict) |
| Frontend typecheck | ✅ |
| Frontend build (24 routes) | ✅ |
| Approved copy present, no stale framing | ✅ |
| Backend copy verified | ✅ |
| Backend typecheck | ✅ |
| Backend tests (no new failures) | ✅ 18 pre-existing only |
| Real 375×812 / 1280 browser smoke | ⏳ OWNER ACTION (headless env — not runnable here) |
| Owner approval to merge → main | ⏳ NOT GIVEN |

**Recommendation:** APPROVED FOR OWNER REVIEW. NOT approved for merge/deploy until the
owner runs the real-viewport smoke and explicitly approves. No deploy, migration,
Cloudflare, nginx, WhatsApp-prod, or admin change was performed.

---

## Appendix: Context Update Record

**Checked:** 2026-05-31
- Git state of both repos (branches, tags, versions, recent commits)
- All user-facing strings in Frontend: AppShell, login, layout, all page components
- All WhatsApp messages in apps/api/src/messages.ts
- Design prototype at Family budget app/ for product framing reference
- VERCEL_DEPLOYMENT_PLAN.md, ADMIN_DASHBOARD_PLAN.md

**Decided:**
- 11 PGS issues classified across 3 release packages
- plan/post-go-live-stabilization branch created in frontend repo (docs only)
- No semantic version tags yet; introduce v0.1.x tags post-deploy
- Product framing: "WhatsApp-first family home-management assistant for money, shopping, projects, children, and day-to-day family coordination"

**Current status:**
- PGS-001 through PGS-010 defined; no implementation yet
- release/stabilization-1 does not exist yet — first implementation agent creates it

**Open decisions for owner (before product-copy-1):**
1. Approve Hebrew product description from section 2c
2. Approve WhatsApp onboarding message drafts (PGS-008, PGS-009, PGS-010)
3. Confirm: Hebrew-only / Israel-only for the immediate roadmap?

**Next step:** Launch Frontend Mobile/Auth Stabilization Agent with prompt in section 10.

---

## Preview QA & Final Owner Review (2026-05-31 — Preview QA & Final Owner Review Agent)

Final verification of the integrated release candidate before owner merge approval.

**Branches verified:** frontend `qa/stabilization-product-copy-integration`
(= `release/stabilization-1` + `release/product-copy-1`, merge `99285d7`; 0 behind / 6 ahead
of `origin/main`); backend `chore/pgs-008-010-whatsapp-copy`.

**Gates (after the two remediations below):** frontend typecheck + build clean (24 routes;
`/shopping-list` 4.72 kB); backend typecheck clean; backend suite **18 failed / 219 passed
(237)** = documented baseline, **0 new failures** (all 18 abort at infrastructure points —
admin-cookie default-token rejection, dispatcher HTTP `res.ok`, Postgres auth — never at a
copy assertion).

**Two copy conflicts found & remediated (both pre-existing on production main, NOT introduced
by these branches; owner approved fixing both):**
- **PGS-013 — shopping-list supermarket-order claim (frontend, commit `385d50d`).** The
  `/shopping-list` route strip still claimed the list is ordered by supermarket walking order
  (`מסלול בסופר` / `הקטגוריות לפי סדר ההליכה`) even though product-copy-1 removed the same
  claim from the empty state. Reworded to neutral category grouping (`לפי קטגוריות` /
  `הרשימה מקובצת לפי קטגוריות`); removed the store entrance/checkout endpoint dots; kept the
  category chip strip.
- **PGS-012 — trial/subscription WhatsApp copy (backend, commit `d03c521`).** `trialDay7`,
  `trialEnded`, `subscriptionExpired` messages still used `עוזר הקניות` / `עוזר הקניות
  המשפחתי`; reworded to Pingtally framing. (Backend commit is local-only; not pushed.)

**Push:** the frontend QA branch was pushed to `origin` to trigger a Vercel **Preview** build
for the owner's real-browser smoke. No production deploy, no merge to main.

**Remaining blocker:** the real **375×812 + 1280×800 browser smoke** on the Preview — owner
action (not runnable headless). Recommendation: **GO for owner merge approval, conditional on
that smoke.**
