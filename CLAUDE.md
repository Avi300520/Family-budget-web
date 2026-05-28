# Family Budget Web — Agent Context

## Product Overview

**קופה משפחתית** (Family Budget) is a WhatsApp-first household budget manager for Israeli families. The frontend (this repo) is the secondary web dashboard — **WhatsApp IS the product.** This web app handles what requires visual admin surfaces: household member setup, budget review, monthly summaries, settings.

**North star:** Every interaction should feel warm and family-resonant, not like another fintech tool.

---

## Architecture — Dual Repo Setup

Two independent codebases, independent deployments:

| Repo | Purpose | Deploy |
|------|---------|--------|
| **Backend** (`C:\Users\avrahamm\Desktop\Shopping assistant`) | WhatsApp webhook, NLP, database, business logic | Hetzner |
| **Frontend** (`C:\Users\avrahamm\Desktop\Family-budget-web`) | Next.js 15 web dashboard (RTL Hebrew) | Vercel |

**Critical rule:** `packages/shared-types` and `packages/api-client` are **copies** in this repo. After any Backend change to those packages, run `pnpm sync:shared` to copy them here. Otherwise, the Frontend build will fail with stale types.

---

## Sync-Shared Script

Location: Backend repo at `scripts/sync-shared.ps1` (Windows) or `scripts/sync-shared.sh` (Bash/Mac/Linux).

**When to run:**
- After any change to Backend `packages/shared-types/src/` or `packages/api-client/src/`
- Before Frontend `pnpm build` or `pnpm typecheck`
- Typically: run after finishing a Backend task, before committing

**What it does:**
1. Copies `packages/shared-types/src/**` from Backend to Frontend
2. Copies `packages/api-client/src/**` from Backend to Frontend
3. Leaves everything else untouched
4. Non-destructive: if destination is missing, creates it

**Example:**
```powershell
cd C:\Users\avrahamm\Desktop\Shopping assistant
pnpm sync:shared  # or ./scripts/sync-shared.ps1
```

**If forgotten:** Frontend typecheck will fail with "Cannot find module '@shopping-assistant/shared-types'" or similar. Fix by manually running the script, then `pnpm typecheck` again.

---

## Git Branches & Deployment

### Current Status (as of May 26, 2026)

| Repo | Branch | Latest Commit | GitHub URL | Notes |
|------|--------|---------------|-----------|-------|
| Frontend | `feat/activity-spending-iteration-5` | TBD | [PR](https://github.com/Avi300520/Family-budget-web/pull/new/feat/activity-spending-iteration-5) | Iteration 5 — DashboardA wired to real data |
| Frontend | `feat/shopping-route-iteration-4` | e53a901 | [PR](https://github.com/Avi300520/Family-budget-web/pull/new/feat/shopping-route-iteration-4) | Iteration 4 + hardening patch |
| Frontend | `feat/dashboard-story-iteration-3` | 7bd4222 | [PR](https://github.com/Avi300520/Family-budget-web/pull/new/feat/dashboard-story-iteration-3) | Iteration 3 complete |
| Frontend | `feat/design-tokens-iteration-0` | a9ff04d | [PR](https://github.com/Avi300520/Family-budget-web/pull/new/feat/design-tokens-iteration-0) | Iteration 0-2 complete + hardening |
| Backend  | `feat/activity-spending-iteration-5` | TBD | [PR](https://github.com/Avi300520/Family-budget/pull/new/feat/activity-spending-iteration-5) | Iteration 5 — activity + spending endpoints |
| Backend  | `feat/shopping-route-iteration-4` | 1802596 | [PR](https://github.com/Avi300520/Family-budget/pull/new/feat/shopping-route-iteration-4) | Iteration 4 + hardening patch |
| Backend  | `feat/sync-shared-script`         | d1e3027 | [PR](https://github.com/Avi300520/Family-budget/pull/new/feat/sync-shared-script) | sync-shared script + docs |

**Latest Iteration 3 commit (64192ea):**
- `feat(web): redesign dashboard story view (Iteration 3)`
  - MonthProgress: teal-gradient hero, dual spend/elapsed progress bars, burn-rate pill
  - PendingApprovals: coral empty state — owner/admin only, no endpoint yet (Iteration 5 gap)
  - ProjectsStrip: Thermometer per project at pct=0 (no accumulated spend from listProjectBudgets)
  - CategoriesPanel: Donut 7-category color taxonomy, no spend numbers yet
  - ActivityFeed: warm placeholder empty state
  - InsightsStrip: warm placeholder empty state
  - LimitedMemberView: personal budget logic preserved, zero household data leakage
  - APIs used: api.me(), api.budgetCurrent(), api.listProjectBudgets() — no new endpoints
  - All gates: typecheck ✅  build (20/20) ✅  no hex ✅  no new deps ✅  no fake data ✅

**CORS — resolved in Phase 2 (branch `release/cors-vercel-hetzner`):**
- Backend `apps/api/src/http.ts` now supports `ALLOWED_ORIGIN_PATTERN` env var (compiled regex)
- Exact-match list still: `[config.WEB_APP_URL, config.ADMIN_APP_URL]`
- Set `ALLOWED_ORIGIN_PATTERN` on the Hetzner server to allow Vercel preview origins
- Recommended pattern: `^https://family-budget-web-[a-z0-9-]+\.vercel\.app$`
- **Never use `^.*\.vercel\.app$`** — too broad, grants any Vercel tenant CORS access
- PUT added to Access-Control-Allow-Methods (required for category-budget saves)
- See Backend CLAUDE.md "CORS Configuration" section for full details

**Hardening patch (a9ff04d — Iteration 2):**
- ActivityHeatmap: slice(-days) for most recent N days
- Negative values: safePositiveNumber() guard on Donut, BarsChart, StackedBar
- Thermometer: pct=0 shows empty state (cream bulb)
- Accessibility: optional ariaLabel props on all main charts

---

## Iterations 0–2 Complete

### Iteration 0 — Design Tokens Foundation (1 day)
**Files created/modified:**
- `apps/web/src/styles/tokens.css` — **single source of truth** for all CSS custom properties (--teal, --coral, --m-mom, --sp-3, --r-2, etc.)
- `apps/web/src/styles/primitives.css` — reusable CSS classes (.panel, .button, .avatar, .grid, .row.between, etc.)
- `apps/web/src/styles/tokens.ts` — TypeScript mirror (string references only, not values)
- `apps/web/src/styles/members.ts` — `colorFor(memberId)` function using FNV-1a hash for deterministic, SSR-stable member colours
- `apps/web/src/app/globals.css` — import tokens + primitives, removed old palette
- `apps/web/src/app/layout.tsx` — added Heebo + JetBrains Mono fonts
- Backend: `scripts/sync-shared.ps1` + `scripts/sync-shared.sh` — cross-repo synchronization

**Key principle:** No hex codes outside `tokens.css`. No numeric padding/margin. All design tokens centralized.

### Iteration 1 — Avatar + Who-Did-What (1 day)
**Files created/modified:**
- `apps/web/src/components/Avatar.tsx` — pure component displaying member initials with colour from `colorFor()`. Sizes: sm (24px), md (32px), lg (44px), xl (60px).
- `apps/web/src/app/dashboard/page.tsx` — added Avatar(lg) in greeting
- `apps/web/src/app/settings/members/page.tsx` — Avatar list for members + cleanup (removed hardcoded colours)
- `apps/web/src/app/shopping-list/page.tsx` — loads members in parallel, maps userId → {displayName}, renders Avatar(sm) for "who added" field

**Key principle:** Every action displays with actor's colour. This is what differentiates "קופה משפחתית" from generic budget app.

### Iteration 2 — Internal Chart Library (1 day)
**Files created/modified:**
- `apps/web/src/components/charts.tsx` — 741 lines, 7 exported components + 2 helpers, pure SVG/CSS, zero external chart dependencies:
  - `clamp(val, min, max)` — guards NaN with `if (!isFinite(val)) return min;`
  - `Donut(size, thickness, segments, total)` — pie chart with centre label
  - `ProgressRing(size, thickness, value 0-1, color)` — circular progress indicator
  - `Thermometer(pct 0-1, color, height)` — vertical fill indicator
  - `BarsChart(data, height, color)` — vertical bar chart with labels
  - `StackedBar(data, height, radius)` — horizontal stacked bar
  - `Sparkline(data[], width, height, color, filled)` — mini trend line
  - `ActivityHeatmap(members[], days=14)` — 2D grid, CSS opacity for intensity (HEAT_OPACITY={0:0, 1:0.2, 2:0.45, 3:0.7, 4:1})

**Key principle:** No external dependencies. All colours from `tokens.ts`. No Math.random, no fake data in prod. Every component has empty state, NaN guards, accessible aria labels.

---

## Known Issues Before Iteration 3

1. **ActivityHeatmap:** Slice direction needs verification — counts array should be oldest→newest, but visual order might be reversed
2. **Charts negative values:** Need validation that negative spending is handled gracefully (clamped or hidden)
3. **Thermometer pct=0:** Should show empty visual, not disappear
4. **Aria labels:** Some components have optional aria-label/title — should default to localized Hebrew if not provided
5. **CORS:** Before Iteration 3 deploy, verify Backend `apps/api/src/middleware/cors.ts` allows `*.vercel.app` and custom domain

---

## Iteration 3 Complete ✅

**Delivered:** Rebuilt `apps/web/src/app/dashboard/page.tsx` as DashboardA (story-first layout).
Branch: `feat/dashboard-story-iteration-3` (commit 64192ea), pushed to GitHub.

**What's still placeholder (needs Iteration 5 backend):**
- `PendingApprovals`: needs `GET /api/v1/households/:id/pending-approvals`
- `ProjectsStrip` Thermometer fill: needs `spent` on `ProjectBudget` from listProjectBudgets, or a batch endpoint
- `CategoriesPanel` real spend: needs `GET /api/v1/households/:id/purchases/by-category?period=current`
- `ActivityFeed`: needs household-wide activity timeline endpoint
- CORS preview-deploy support: needs pattern-match allowlist in `apps/api/src/http.ts`

## Iteration 4 Complete ✅ (including hardening patch)

**Delivered:** Shopping list rebuilt as a supermarket-route experience
(`apps/web/src/app/shopping-list/page.tsx`) and Backend categorizes items
at insert time into 7 fixed categories. Branches:
`feat/shopping-route-iteration-4` on both repos.

**Shared-types added** (`packages/shared-types/src/shoppingCategories.ts`):
7 categories — `vegetables`, `bakery`, `dairy`, `pantry`, `snacks`,
`frozen`, `household` — each with `id` / `nameHe` / `icon` / `order`.
`ShoppingListItem.categoryId: ShoppingCategoryId` — **required, always
populated** (not optional). Backend guarantees it: new items are
categorized at insert; legacy pre-0017 rows are categorized via
`rowToShoppingListItem` read-fallback (no DB write). Frontend
`categoryOf(item)` returns `item.categoryId` directly — no `??` needed.

**Frontend page:** ShoppingHeader + RouteMap + CardsView/ListView toggle
+ ItemRow with Avatar(sm). All colours via tokens, no new hex, no fake
data.

**Backend patch (same branch):**
- `rowToShoppingListItem`: if `category_id IS NULL`, computes
  `categorize(normalizedName ?? rawText)` at read time — no DB write.
  This fixes legacy items showing as "pantry" regardless of their name.
- `ask_shopping_list` fast-path and `QUERY_LIST` NLP handler both now call
  `organizeShoppingListText()`. "תביא לי את הרשימה" now returns the same
  7-category grouped format as the web send-to-WhatsApp button.
- Migration 0017 has full safety comment block: IF EXISTS, NULL-allowable
  CHECK, production safety query, backfill rationale.
- CORS WIP (`http.ts` pattern-match) stashed as `cors-vercel-preview-wip`
  — deferred to Iteration 5.

**Backend:** Migration 0017 swaps the unused `category_id uuid` column
for `category_id text` with a CHECK constraint. `addShoppingItem` calls
`categorize()` (deterministic Hebrew regex lexicon, no LLM — gap doc'd).
`organizeShoppingListText` groups by stored category, falls back to
on-the-fly `categorize()` for legacy items.

## Iteration 5 Complete ✅ — DashboardA wired to real data

**Branches (both repos):** `feat/activity-spending-iteration-5`

**What changed (Frontend `apps/web/src/app/dashboard/page.tsx`):**
- `CategoriesPanel` now takes `spending: SpendingByCategoryEntry[]` and renders
  proportional Donut segments + a per-category list with ILS amounts. When
  total spend is 0 a warm empty state replaces the donut. Categories with no
  spend appear in the legend at 40% opacity (taxonomy reference only).
- `ActivityFeed` now takes `entries: ActivityEntry[]` and renders the unified
  expense + shopping + approval feed (capped at 12 visible rows). Each row
  has Avatar(sm) coloured by `actorUserId`, Hebrew template text from the
  server, Hebrew relative-time label (`timeAgoHe`), and an optional coral
  "ממתין" pill for `needsApproval`. Three states: loading / empty / data.
- `FamilyView` receives `activity` and `spendingByCategory` as new props.
- Main page loads `householdActivity` + `spendingByCategory` in the same
  `Promise.all` as budget + projects. `limited_member` short-circuits to
  empty arrays — never even calls the endpoint (extra defence on top of the
  Backend 403). Each endpoint has its own `.catch(() => fallback)` so a
  transient failure on one panel doesn't blank the dashboard.

**What is NOT wired in this iteration (intentional):**
- `spending/by-member` — endpoint + api-client method ready; UI will arrive
  in DashboardB (Iteration 9).
- `spending/by-weekday` — endpoint + api-client method ready; will likely
  surface inside the Insights strip later or in DashboardB.
- `InsightsStrip` — still placeholder (Iteration 7).
- `PendingApprovals` — empty state preserved; depends on a list endpoint
  not built in this iteration (the activity feed already surfaces pending
  approvals as rows with the "ממתין" pill).

**Endpoints consumed:** `api.householdActivity`, `api.spendingByCategory`
(in addition to the pre-existing `me`, `budgetCurrent`, `listProjectBudgets`).

**limited_member privacy:**
- `LimitedMemberView` unchanged — still shows personal budget only.
- Family endpoints are short-circuited client-side AND blocked server-side
  with 403, so a role flip mid-session never leaks household data.
- Visual smoke 2026-05-26 (dev servers running, real cookies, Playwright):
  network log captured during a limited-member dashboard load shows only
  `GET /me` and `GET /budget/current` — no calls to `/activity`,
  `/spending/by-category`, `/spending/by-member`, `/spending/by-weekday`,
  or `/project-budgets`.

**ActivityFeed privacy scope (Option A — household-shared only):**
Personal expenses (`expense_type='personal'`) are filtered out at the
Backend store level — they never reach the Frontend, regardless of who
logged them. ActivityFeed shows: household expenses + project expenses
(rendered with `(פרויקט)` suffix) + active shopping items + pending
household approvals. This matches the system-wide invariant that personal
spending is invisible to other family members. Documented in detail in
the Backend CLAUDE.md "Activity-feed privacy scope" section.

**⚠️ Project expense visibility assumption — do not break silently:**
Project expenses appear in the ActivityFeed because all project budgets are currently
household-scoped (a project always belongs to one household and all members can see it).
**If private projects are ever added**, the Backend `listHouseholdActivity` must gain an
explicit `project_visibility` filter before that iteration ships. The current code has NO
such filter — without it, private project spending would be silently visible to all members.

**Gates:** typecheck ✅ · build (20 routes, dashboard 6.37 kB) ✅ ·
no new deps ✅ · no new hex ✅ · no fake data ✅ · CORS untouched ✅ ·
shared-types synced ✅ · backend 148/148 tests ✅ · visual smoke ✅
(owner @ 1280 + 375 with data and empty states, limited_member privacy
verified end-to-end via Playwright)

## Iteration 5 Next Steps

**🚫 PRE-DEPLOY BLOCKER — viewport smoke:**
The Iteration 5 mobile smoke was accepted as CSS-level simulation (responsive rules force-applied at 1280px Playwright viewport because the Chrome extension was unavailable). **This is NOT sufficient for production deploy.** Before merging to main / deploying to Vercel, run a real Playwright/browser viewport smoke at **375×812** (actual `page.setViewportSize({width:375, height:812})` or Chrome extension `resize_window`). Confirm: no horizontal overflow, ActivityFeed wraps, Donut+legend don't overlap, panels single-column, ממתין pill visible.

---

## Iteration 6 Complete ✅ — DB-backed member colours

**Branches (both repos):** `feat/member-color-iteration-6`

Member avatar colour now comes from the **API** (`HouseholdMember.color`), not from a
client-only hash. The deterministic hash stays only as a defensive fallback.

**What changed (Frontend):**
- `styles/members.ts` — `colorFor(memberId, assigned?)`: when the server provides a colour
  key it wins; otherwise fall back to the FNV-1a `memberKeyFor(memberId)`. `memberKeyFor` is
  byte-for-byte identical to the Backend `pickMemberColor`, so DB colour and fallback render
  the same pixels (no flicker, no visual change).
- `components/Avatar.tsx` — new optional `colorKey?: string | null` prop; passes it to
  `colorFor`. When absent, hash fallback as before. No size/markup redesign.
- `dashboard/page.tsx` — loads `api.listMembers` (in the same `Promise.all`, short-circuited
  to `[]` for `limited_member`), builds a `userId → color` map, passes it to `ActivityFeed`
  (avatar `colorKey`) and uses `membership.color` for the greeting avatar.
- `settings/members/page.tsx` — member list avatars use `colorKey={m.color}`.
- `shopping-list/page.tsx` — `MemberInfo` carries `colorKey`; "who added" avatars use it.

**Shared packages:** `MemberColorKey` + `HouseholdMember.color?` in shared-types; api-client
`updateMember` body gains `color?: string`. Synced from Backend via `pnpm sync:shared`
(both packages byte-identical across repos).

**limited_member privacy (verified, no regression):** the new `/members` colour-map fetch is
short-circuited client-side for limited members AND household-only endpoints stay 403 server-side.
Runtime smoke (memory-mode backend + Next dev): a limited-member dashboard fetched only `/me` +
`/budget/current` — no `/members`, `/activity`, `/spending/*`, or `/project-budgets`. Their own
avatar still renders their DB colour (`--m-dad`).

**Gates:** typecheck ✅ · build (20 routes, dashboard 6.47 kB) ✅ · no new deps ✅ ·
no new colour tokens (reuses `--m-*` palette) ✅ · no fake data ✅ · CORS untouched ✅ ·
shared-types + api-client synced ✅ · Backend 154/154 tests ✅.
Desktop visual smoke (owner): greeting avatar rendered `--m-mom` after the member's DB colour
was forced to `mom` while its hash is `dad` — proving the UI consumes the DB colour, not the
hash. (Screenshots unavailable in this environment; colour verified via computed styles, the
recommended method.) **Mobile 375×812 smoke stays under the pre-deploy blocker above — this
iteration changes no layout.**

---

## Iteration 7 Complete ✅ — Insights / Weekly Wrapped (deterministic)

**Branches (both repos):** `feat/insights-iteration-7`

A new top-level **/insights** route renders a deterministic, server-composed
weekly recap — Spotify-Wrapped-flavoured Hebrew cards for a Sun–Sat Israeli
week. Insights come pre-baked from the API, so the Frontend never composes
Hebrew strings and never directly fetches `/spending/by-member` or
`/spending/by-weekday` (those stay reserved for DashboardB / Iteration 9).

**What changed (Frontend):**
- `app/insights/page.tsx` — new top-level route. Fetches
  `api.weeklyInsights(householdId, week)` for the requested period, plus
  `api.listMembers` to enrich the `top_member` card with the persisted
  Iteration 6 colour. `limited_member` is short-circuited client-side
  (no `/insights/weekly` fetch issued) and rendered a warm Hebrew message
  instead — the server's 403 is a redundant second layer.
- `components/InsightCard.tsx` — small presentational tile, reuses
  existing `.panel` primitive. `top_member` renders the Iteration 6
  `Avatar` with the DB-backed `colorKey`; all other kinds show a static
  emoji icon. No new CSS tokens, no new colour variables.
- `components/AppShell.tsx` — adds a "תובנות" nav link (✨ Sparkles icon)
  scoped to `owner | admin | adult_member`. `limited_member` does not see it.
- Period toggle "השבוע / השבוע שעבר" inside the page; switches the
  `week=current|last` query param and re-fetches atomically.

**No dashboard redesign:** `dashboard/page.tsx` is unchanged. The
pre-existing `InsightsStrip` placeholder on the dashboard ("תובנות חכמות
בקרוב") stays as-is in this iteration; the new dedicated /insights surface
is the canonical home. A future iteration may replace that placeholder with
a teaser strip pointing into /insights.

**Shared packages:** `WeeklyInsight`, `WeeklyInsightsResponse`, `InsightKind`
in shared-types. api-client: `weeklyInsights(householdId, week?)`. Synced
from Backend via `pnpm sync:shared` — both packages byte-identical across
repos.

**Privacy (verified, no regression):**
- `limited_member` is **403** at `/api/v1/households/:id/insights/weekly`
  (HTTP router guard) and the Frontend never issues the fetch (AppShell
  hides the link AND the page short-circuits on role).
- Server insights composition consumes only Iteration 5 store reads that
  already filter to `expense_type='household' AND project_budget_id IS
  NULL AND status='confirmed'`. Personal AND project-attributed expenses
  therefore cannot leak into any insight metric.

**Hebrew source-string check:** all user-facing Hebrew on this page
("תובנות השבוע", "השבוע", "השבוע שעבר", "התובנות זמינות לחברי הבית הבוגרים",
"לא הצלחנו לטעון את התובנות. נסו לרענן.") is in correct logical order —
no reversed Hebrew in source files. Server `headlineHe` strings come from
`apps/api/src/messages.ts` (also logical order).

**Gates (all green):**
- `pnpm typecheck` ✅ clean
- `pnpm build` ✅ clean — **21 routes** total (was 20).
  `/insights` First Load JS: **1.72 kB** (well under the 5 kB budget).
  `/dashboard` size: **6.47 kB** (unchanged vs. Iteration 6 baseline).
- Backend gates: 166/166 tests pass (154 + 12 new insights tests),
  typecheck clean.
- `pnpm sync:shared` run; shared-types + api-client byte-identical between
  repos at commit time.
- CORS untouched ✅ — `cors-vercel-preview-wip` stash remains on
  `feat/shopping-route-iteration-4`, NOT in any Iteration 7 commit.
- No `/spending/by-member` or `/spending/by-weekday` Frontend consumer
  added (Iteration 9 territory).

**Deferred (NOT this iteration):**
- DashboardB consumption of by-member / by-weekday → Iteration 9.
- Per-category budget caps → later candidate.
- `project_moment` insight kind — deferred until the project-private
  visibility design lands.
- Monthly / yearly Wrapped surfaces.
- Mobile 375×812 real-viewport smoke — remains a **pre-deploy blocker**
  for all post-Iteration 5 work, not an Iteration 7 gate. This iteration
  changes no layout primitives.

---

## Iteration 8 Complete ✅ — Wishlist (rich ChildView)

**Branches (both repos):** `feat/wishlist-iteration-8`

A per-user private wishlist. Children keep a list of things they want on their
own dashboard; owner/admin review children's lists on a dedicated parent route
and mark items "נקנה". Deterministic — the Frontend renders API-backed data and
server Hebrew copy; it composes no Hebrew strings of consequence beyond plain
UI labels (all in logical order in source).

**What changed (Frontend):**
- `components/WishlistPanel.tsx` — the caller's OWN wishlist. Loads
  `api.myWishlist()`, supports add (title + optional ⭐ "חשוב לי" → priority
  high) and soft-delete of own items. **No mark-fulfilled** — that is
  owner/admin-only and lives on the parent route. Reuses `.card`, `.input`,
  `.button`, `.btn sm ghost`, `.status` primitives; no new tokens.
- `app/dashboard/page.tsx` — `LimitedMemberView` now renders `<WishlistPanel />`
  below the quick-actions. `FamilyView` is unchanged (owner/admin/adult do not
  get a personal WishlistPanel this iteration).
- `app/family/wishlists/page.tsx` — new route, **owner/admin only**. Fetches
  `api.householdWishlist(householdId)` (server returns ONLY limited_member-owned
  items) + `api.listMembers` for names/colours. Groups items by child, renders
  each child with the persisted Iteration 6 `Avatar` `colorKey`. Owner/admin can
  "סמן כנקנה" (fulfilled) or "הסר" (delete). Non-parents who navigate directly
  are short-circuited client-side (no fetch) and shown a friendly Hebrew message;
  the server returns 403 as the redundant second layer.
- `components/AppShell.tsx` — adds a "משאלות" nav link (🎁 Gift icon) scoped to
  `owner | admin` ONLY. adult_member and limited_member see no link and never
  fetch the household wishlist.

**Shared packages:** `WishlistItem`, `WishlistItemStatus`,
`WishlistItemPriority` in shared-types; api-client gains `createWishlistItem`,
`myWishlist`, `householdWishlist`, `updateWishlistItem`, `deleteWishlistItem`.
Synced from Backend via `pnpm sync:shared` — both packages byte-identical
across repos.

**Privacy (verified by gates + backend tests):**
- adult_member and limited_member → **403** on
  `/api/v1/households/:id/wishlist`; the AppShell hides the link and neither
  the dashboard nor any page issues that fetch for them.
- A limited_member only ever sees their own items (`/wishlist/me` is
  caller-scoped); they cannot see, mutate, or enumerate a sibling's item via
  any route or via the `QUERY_WISHLIST` WhatsApp command (caller-only by
  construction).
- Marking fulfilled is a status change only — no purchase row, no budget,
  insights, notifications, or expense conversion.

**Gates:** Frontend typecheck ✅ · build ✅ (**22 routes**, was 21;
`/family/wishlists` 2.49 kB First Load; dashboard 7.77 kB, up from 6.47 kB for
the WishlistPanel) · no new deps ✅ · no new CSS tokens ✅ · no fake data ✅ ·
CORS untouched ✅ · shared-types + api-client synced byte-identical ✅ ·
Backend 178/178 tests ✅. **Real browser/mobile 375×812 smoke remains a
pre-deploy blocker** (now extended to cover the WishlistPanel + /family/wishlists)
— not an Iteration 8 gate; this iteration introduces no new layout primitives.

**Deferred:** web surface for owner/admin's OWN wishlist (backend supports it,
not surfaced this iteration); per-category budget caps; DashboardB
(`/spending/by-member`, `/spending/by-weekday`) → Iteration 9; CORS preview
matching.

---

## Iteration 9 Complete ✅ — DashboardB + Member Activity Heatmap

**Branch:** `feat/member-heatmap-iteration-9`

**New route:** `/family/pulse` (owner/admin/adult_member only).

**What was built:**

- `apps/web/src/app/family/pulse/page.tsx` (new) — three-panel DashboardB:
  1. **Member Spend Bars** — current-period spend per member from
     `/spending/by-member`. Uses existing `BarsChart` from `charts.tsx`.
  2. **Weekday Spend Bars** — current-period spend by day of week from
     `/spending/by-weekday`. Uses existing `BarsChart`.
  3. **Activity Heatmap** — per-member, per-day confirmed household
     purchase counts for the last 14 days from the new
     `/activity/heatmap` endpoint. Uses existing `ActivityHeatmap` from
     `charts.tsx`. Personal + project expenses excluded.
  Limited-member short-circuit: client-side role check prevents any
  fetches; friendly Hebrew message shown instead.

- `apps/web/src/components/AppShell.tsx` — `Activity` icon from
  `lucide-react` added; new nav entry:
  `{ href: "/family/pulse", label: "פעילות", roles: ["owner","admin","adult_member"] }`.
  DashboardA `/dashboard` untouched.

**Backend additions (synced via pnpm sync:shared):**
- `MemberHeatmapRow` + `MemberActivityHeatmapResponse` in shared-types.
- `memberActivityHeatmap(householdId, days?)` in api-client.
- `GET /api/v1/households/:id/activity/heatmap?days=N` — days default 14,
  max 31; limited_member → 403 (two-layer). No new migration.
- MemoryStore + PostgresStore parity. 11 new tests in `heatmap.test.ts`.

**Gates:** Frontend typecheck ✅ · build ✅ (**23 routes**, was 22;
`/family/pulse` 1.62 kB First Load) · no new deps ✅ · no new CSS tokens ✅ ·
no fake data ✅ · CORS untouched ✅ · shared-types + api-client synced
byte-identical ✅ · Backend 189/189 tests ✅.
**Real browser/mobile 375×812 smoke remains a pre-deploy blocker** (now
extended to cover /family/pulse all 3 panels).

**Deferred:** per-category budget caps; owner/admin own-wishlist web surface;
mobile 375×812 real-viewport smoke; CORS preview matching; private-project
visibility design.

---

## Iteration 10 Complete ✅ — Per-category monthly budget caps (web-only)

**Branches (both repos):** `feat/category-caps-iteration-10`

Owner/admin set a monthly cap per purchase category; the cap drives a spent/cap
progress bar in DashboardA's CategoriesPanel. Deterministic, **web-only — no
WhatsApp/NLP, no alerts** (both explicitly out of scope). Finally consumes the
long-reserved `SpendingByCategoryEntry.budget` field.

**What changed (Frontend):**
- `app/dashboard/page.tsx` — `CategoriesPanel` gains a `categoryBudgets` prop.
  For a category with a cap it renders a spent/cap progress bar reusing the
  existing `.progress` + `.progress-fill.amber|.rose` primitives (**no new CSS**):
  amber at ≥ 70%, rose at ≥ 90%; the bar visually clamps to 100% even when
  overspent, while the numeric text shows the REAL spent amount. **Categories
  without a cap render exactly as before** — the cap map is empty → zero visual
  change, so DashboardA layout is unchanged. Caps are fetched in the same
  `Promise.all` (family-only; `limited_member` short-circuits and never fetches
  `/category-budgets`).
- `app/settings/category-budgets/page.tsx` (new) — owner/admin editor for the 7
  categories (set / clear each cap). Non-parents who navigate directly are
  short-circuited client-side (no fetch) and shown a Hebrew access message; the
  server 403 is the redundant second layer.
- `app/settings/page.tsx` — new "תקציבי קטגוריות" hub card (owner/admin only;
  uses the Wallet icon).

**Shared packages:** `CategoryBudget` in shared-types; `SpendingByCategoryEntry.budget`
doc updated (reserved → populated). api-client gains `categoryBudgets`,
`setCategoryBudget`, `removeCategoryBudget`. Synced from Backend (PowerShell was
unavailable, so the `sync:shared` copy was performed manually and verified
byte-identical with `diff -rq`).

**Privacy (no regression):** `limited_member` → 403 on all three
`/category-budgets` endpoints AND the dashboard + settings page never issue the
fetch for them. adult_member may READ caps (shown the dashboard progress bars)
but is 403 on PUT/DELETE (no edit). Personal + project expenses are excluded from
cap progress by the preserved household-budget filter.

**Gates:** Frontend typecheck ✅ · build ✅ (**24 routes**, was 23;
`/settings/category-budgets` 2.13 kB First Load; dashboard 7.05 kB) · no new deps
✅ · no new CSS tokens ✅ · no fake data ✅ · CORS untouched ✅ · shared-types +
api-client synced byte-identical ✅ · Backend 201/201 tests ✅. **Real
browser/mobile 375×812 smoke remains a pre-deploy blocker** (now extended to cover
CategoriesPanel cap progress states + the /settings/category-budgets editor) — not
an Iteration 10 gate; this iteration adds no new layout primitives.

**Deferred:** per-category 70%/90% alerts (clean follow-on reusing
`budget_alert_log`); WhatsApp/NLP category query; cap proration; owner/admin
own-wishlist web surface; mobile 375×812 real-viewport smoke; CORS preview
matching; private-project visibility design.

---

## Pre-deploy blockers / Release hardening ledger

These items are NOT blockers for continuing product iterations, but they ARE blockers before merge to main, production deploy, or Vercel/Hetzner release.

* [ ] Real mobile viewport smoke at 375x812, using actual browser/Playwright viewport, not CSS simulation.
  Must cover owner/admin, limited_member, household with data, empty household, ActivityFeed, CategoriesPanel (including category-budget progress states: no-cap rows unchanged, capped rows showing the spent/cap bar at <70% / amber ≥70% / rose ≥90% / overspent clamped to 100% with real numeric text), the /settings/category-budgets editor, /insights, the limited_member dashboard with WishlistPanel, the /family/wishlists parent route, the /family/pulse route (all 3 panels), and pending approval pill.

  **Phase 3 status (branch `release/mobile-smoke-fixes`):** Real 375×812 + 1280 browser smoke executed (Claude Preview real Chromium viewport, NOT CSS simulation). Two release-blocking defects found and FIXED (frontend-only):
  - **`/family/pulse` inverted role gate** — `isLimited === false` showed the access message to owner/admin/adult and hid all 3 charts, while limited saw empty panels. Fixed: condition flipped to `isLimited === true` in `apps/web/src/app/family/pulse/page.tsx`. Re-verified at 375 + 1280: owner+adult see member bars + weekday bars + ActivityHeatmap (real data); limited sees the access message and fetches only `/me`; empty household shows empty-state panels.
  - **`/shopping-list` mobile horizontal overflow** — the route-map strip forced `document.scrollWidth` to 469px at a 375 viewport (root cause: `main` is a grid item with `min-width:auto`, so the strip's intrinsic width propagated up). Fixed locally with `flex-wrap:wrap` (+`rowGap`) on the route strip in `apps/web/src/app/shopping-list/page.tsx`; re-verified docSW==375 (no overflow, route wraps) at 375 and single-row at 1280. Header toolbar untouched (proven not the cause). `overflow-x` scrolling alone did NOT fix it (the grid item re-expanded).
  All other listed surfaces (dashboard cap states <70/amber/rose/overspent-clamped, ActivityFeed, ממתין pill, /insights toggle + DB-color top_member avatar, /family/wishlists child lists + mark-fulfilled, /settings/category-budgets editor, limited dashboard + WishlistPanel, empty-household states) passed the 375 smoke. **Phase 3 defects: CLOSED.** Pre-deploy requirement still open: run a final smoke on the fully merged release state before deploy.

* [x] Weekly-summary fallback integration proof. (**Closed — commit `38971b4`**)
  Integration test `apps/api/src/weekly-summary-fallback.test.ts` proves that `POST /dev/weekly-summary/run` still enqueues the base WhatsApp summary to the outbox even when the injected `insightsProvider` throws.

* [x] CORS release branch. (**Phase 2 complete — branch `release/cors-vercel-hetzner`**)
  PUT in Access-Control-Allow-Methods; ALLOWED_ORIGIN_PATTERN for preview URLs. Backend CLAUDE.md documents full configuration.

* [ ] Production migration sanity.
  Verify migrations apply cleanly from the current production-like DB state through 0020 (incl. `category_budgets`) and any later migrations. Confirm existing data survives and member colors are deterministic.

* [ ] Final shared packages audit.
  Run pnpm sync:shared and verify packages/shared-types/src/index.ts and packages/api-client/src/index.ts are byte-identical across Backend and Frontend repos.

* [ ] Final Git/GitHub audit.
  Verify all release branches are pushed, commit hashes documented, working trees have no tracked changes, and unrelated local artifacts are not included in commits.

* [ ] No fake/demo data in production paths.
  Verify dashboard, shopping list, insights, activity feed, and budget views render only API-backed data or intentional empty states.

* [ ] `NEXT_PUBLIC_API_URL` fail-loud — fixed at the code level (Agent 4, branch `release/final-predeploy-remediation`).
  New `apps/web/src/lib/apiBase.ts` and `apps/admin/src/lib/apiBase.ts` helpers throw at module-evaluation time when `NODE_ENV=production` AND the env var is unset. Dev fallback is now `http://localhost:3333` (was incorrectly `localhost:4000`). Consumers: `apps/web/src/lib/api.ts`, `apps/admin/src/lib/api.ts`, `apps/web/src/app/export/page.tsx`, `apps/web/src/app/receipts/[id]/review/page.tsx`. Operator MUST set `NEXT_PUBLIC_API_URL=https://api.pingtally.com` in Vercel (Settings → Environment Variables) for BOTH Production AND Preview before deploy. Browser/runtime smoke of dashboard/export/receipts review pages remains an open pre-deploy item (no browser environment available in Agent 4 run).

* [ ] `apps/admin` deployment target — documented (Agent 4).
  `vercel.json` builds only `apps/web`. `apps/admin` is therefore **local-only / not Vercel-exposed**. If admin is ever deployed in a future iteration, it requires its own `NEXT_PUBLIC_API_URL` env var, access protection, and an explicit deploy config.

* [ ] limited_member privacy release smoke.
  Verify limited_member does not fetch or see household-only endpoints, including /activity, /spending/*, /members, /insights/weekly, /households/:id/wishlist, /activity/heatmap, /households/:id/category-budgets (GET/PUT/DELETE), and any later household-only endpoints. Also verify adult_member can READ /category-budgets but is 403 on PUT/DELETE.

  **Phase 3 `/members` privacy decision — B7 RESOLVED (backend commit `c871e15`):** Smoke had found `GET /households/:id/members` returning 200 to `limited_member` including every member's `phoneE164`, and audit confirmed a real limited_member production dependency: **`/shopping-list`** (limited-accessible) calls `listMembers` for who-added avatars. Blanket 403 was rejected (would drop who-added + emit 403 noise) and self-only rejected (breaks cross-member who-added). **Implemented fix (narrowest safe):** `GET /households/:id/members` now returns ONLY `{userId, displayName, role, color, status}` to `limited_member` (`phoneE164` stripped); owner/admin/adult_member keep the full enriched payload unchanged; **not a blocker** — fix is in backend `release/mobile-smoke-fixes`, commit `c871e15`. (The limited dashboard, /insights, /family/wishlists, /family/pulse already gate the `/members` fetch for limited; only /shopping-list consumes it.)

* [ ] Wishlist sibling-visibility release smoke.
  Verify that no limited_member can see, mutate, or enumerate a sibling's wishlist item through /wishlist/me, /households/:id/wishlist, /wishlist/:itemId PATCH/DELETE, or QUERY_WISHLIST via WhatsApp.

Use this exact section as the single source of truth for pre-deploy reminders. Going forward, any new item marked "remember before deploy" must be added to this section in both repos.

---

## Code Conventions

**RTL Hebrew:** All pages are RTL by default. Phone inputs get `dir="ltr"`. Numbers render naturally LTR within RTL context.

**CSS Primitives:** Use `.panel`, `.button[.secondary|.warn]`, `.progress`, `.grid.two/.three`, `.row.between`, `.mono`, `.avatar`. Don't invent new classes.

**Colours:** Always `var(--tealish)`, never `#2196f3`. Fallback for future-proofing: `var(--teal, #2196f3)` if needed, but primary source is `tokens.css`.

**Fonts:** Heebo for UI (Hebrew), JetBrains Mono for numbers/codes. Loaded via `next/font/google` in `layout.tsx`.

**Accessibility:** Every interactive element has `aria-label`, `role`, or `title`. Aria labels in Hebrew where user-facing.

---

## Testing & Verification

Before each iteration commit:
1. `pnpm typecheck` — zero errors
2. `pnpm build` — production build succeeds
3. `pnpm lint` (if configured)
4. Manual verification:
   - Desktop (1280px): all pages load, no visual glitches
   - Mobile (390px): responsive, text readable
   - Different roles: owner/admin/limited_member each see correct views
   - WhatsApp integration: send test messages from Backend, confirm replies parse correctly

---

## Deployment

**Frontend:** Vercel, auto-deploy on GitHub push to `main`. Preview deploys on PR.
**Backend:** Hetzner, manual or CI-based (see Backend CLAUDE.md).

**Before Iteration 3 goes live:**
- Create PR from `feat/design-tokens-iteration-0`
- Review + merge to `main`
- Vercel auto-deploys
- Confirm `NEXT_PUBLIC_API_URL` in `.env.local` (dev) and Vercel (prod) points to correct Backend
- Test full flow: WhatsApp message → Backend → Frontend dashboard updates correctly

---

## File Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          (imports fonts, tokens, primitives)
│   │   ├── globals.css         (@import tokens + primitives)
│   │   ├── dashboard/
│   │   │   └── page.tsx        (story view + limited_member view)
│   │   ├── settings/
│   │   │   └── members/
│   │   │       └── page.tsx    (member list + colours)
│   │   ├── shopping-list/
│   │   │   └── page.tsx        (items with who-added avatars)
│   │   └── ...
│   ├── components/
│   │   ├── Avatar.tsx          (member initials + colour)
│   │   ├── charts.tsx          (7 chart components)
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts              (typed fetch client)
│   │   └── ...
│   └── styles/
│       ├── tokens.css          (CSS custom properties - SOURCE OF TRUTH)
│       ├── primitives.css      (class utilities)
│       ├── tokens.ts           (TypeScript mirror)
│       └── members.ts          (colorFor function)
└── ...
```

---

## Contact & Questions

- **Product owner:** avi300520@gmail.com
- **Backend repo:** https://github.com/Avi300520/Family-budget
- **Frontend repo:** https://github.com/Avi300520/Family-budget-web
