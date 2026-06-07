# Pingtally — Copy and Messaging Registry

**Purpose:** Single inventory of all user-facing text. Each entry captures current text,
location, the problem, proposed replacement, and owner approval status.
**Last updated:** 2026-05-31 (updated post-implementation)
**Status:** PGS-003/007B implemented — PGS-008–010 backend implemented — PGS-009 WhatsApp copy live on chore/pgs-008-010-whatsapp-copy

---

## How to Use This Registry

- **APPROVED** — may be implemented in release/product-copy-1 (or release/stabilization-1 for P1 items)
- **PENDING** — requires owner review before any code change
- **KEEP** — acceptable as-is; no change needed
- **DEV-ONLY** — not user-facing in production; listed for completeness

PGS-003 items (A4, A5) are approved as obvious fixes and go in release/stabilization-1.
All other PENDING items go in release/product-copy-1 after owner approval.

---

## Section A — Frontend UI Strings

| ID | Current Text | File + Line | Screen / Context | Problem | Proposed Replacement | Owner Approval | Release | Testing Notes |
|----|-------------|-------------|------------------|---------|---------------------|----------------|---------|---------------|
| A1 | עוזר הקניות המשפחתי | apps/web/src/components/AppShell.tsx:53 | Sidebar/header brand label (every page) | Narrow — "shopping assistant" undersells the full household-management scope | PENDING OWNER DECISION — see stabilization plan section 2c | PENDING | PGS-007B | After change: no "עוזר הקניות" visible in any viewport; no layout regression |
| A2 | קופה משפחתית | apps/web/src/app/layout.tsx:19 | Browser tab title, bookmark name | "קופה" = supermarket checkout; may feel narrow | Owner may keep or update | PENDING | PGS-007B | After change: `<title>` in page HTML matches approved copy |
| A3 | ניהול תקציב משפחתי דרך וואטסאפ | apps/web/src/app/layout.tsx:20 | Meta description (search snippets, social share) | Narrow — mentions only budget; omits shopping, projects, allowances | Suggest: "ניהול כסף, קניות ופרויקטים משפחתיים דרך וואטסאפ" | PENDING | PGS-007B | |
| A4 | קישור נשלח ל-Dev inbox | apps/web/src/app/login/page.tsx:19 | Status message after phone submit on login | P1 BLOCKER — "Dev inbox" is developer-only text; production users see this | שלחנו לך קישור לוואטסאפ — לחץ עליו כדי להיכנס | APPROVED | PGS-003 | After submit: new message visible; no "Dev inbox" in page HTML |
| A5 | פתיחת Dev inbox | apps/web/src/app/login/page.tsx:41 | Link on login page href="/dev-inbox" | P1 BLOCKER — developer-only link visible in production | Remove entirely | APPROVED | PGS-003 | After fix: no "Dev inbox" link, no "/dev-inbox" href in login HTML |
| A6 | כניסה דרך WhatsApp | apps/web/src/app/login/page.tsx:28 | Login page heading | Acceptable — clear and accurate | No change | KEEP | — | |
| A7 | טלפון (placeholder) | apps/web/src/app/login/page.tsx:31 | Phone input placeholder | Tied to PGS-005 (broken input model) | Update after PGS-005 component is fixed | PENDING | PGS-005 | |
| A8 | דשבורד, רשימת קניות, תקציב, תובנות, פעילות, משאלות, הגדרות | apps/web/src/components/AppShell.tsx | Navigation labels (sidebar) | All accurate and appropriate | No change | KEEP | — | |
| A9 | שלום {greetingName} | apps/web/src/app/dashboard/page.tsx:1031 | Dashboard greeting | Warm and personal — no problem | No change | KEEP | — | |
| A10 | לא הצלחנו לטעון את הדשבורד. נסה לרענן. | apps/web/src/app/dashboard/page.tsx:997 | Dashboard error state | Correct Hebrew error pattern | No change | KEEP | — | |
| A11 | הרשימה ריקה + WhatsApp example | apps/web/src/app/shopping-list/page.tsx:530-533 | Shopping list empty state | Functional and instructive | No change | KEEP | — | |

---

## Section B — Browser Metadata

| ID | Current | File + Line | Context | Problem | Proposed | Owner Approval | Release | Notes |
|----|---------|-------------|---------|---------|----------|----------------|---------|-------|
| B1 | lang="he" dir="rtl" | apps/web/src/app/layout.tsx:25 | HTML root element | Correct | No change | KEEP | — | |
| B2 | (not found) | apps/web/src/app/layout.tsx | Open Graph / social share tags | Missing — no rich WhatsApp preview when link shared | Add og:title + og:description after copy approved | PENDING | PGS-007B | Optional; add after A2/A3 approved |
| B3 | (not found) | apps/web/public/ | PWA manifest | No manifest.json | Not a blocker; add if PWA needed | PENDING | Future | |

---

## Section C — WhatsApp Messages (Backend — apps/api/src/messages.ts)

| ID | Current Text (abbreviated) | Function + Line | Context | Problem | Proposed | Owner Approval | Release | Testing Notes |
|----|---------------------------|-----------------|---------|---------|----------|----------------|---------|---------------|
| C1 | ברוכים הבאים לעוזר הקניות המשפחתי! ... | onboardingInvitationMessage — messages.ts:173 | First WhatsApp message a new user receives | "עוזר הקניות" = narrow; product is broader | PENDING OWNER APPROVAL — draft to be agreed before implementation | PENDING | PGS-008 | After change: integration test still passes; message ≤ 5 lines |
| C2 | הבית הוגדר! ברוכים הבאים. | onboardingCompletedMessage — messages.ts:150 | Sent after household is created | Terse — no next-step guidance | Should explain: what to send + link to dashboard | PENDING | PGS-009 | |
| C3 | לדשבורד המשפחתי... (full text) | onboardingDashboardHintMessage — messages.ts:164 | Post-setup dashboard pointer | May be sufficient or may merge with C2 | Review full text; consider merging with C2 | PENDING | PGS-009 | |
| C4 | ברוך הבא לבית {householdName}! | welcomeMessage (adult path) — messages.ts:121 | adult_member or admin joins | Very brief; no context about what to do next | Add role-contextual guidance | PENDING | PGS-010 | |
| C5 | ברוך הבא לבית {householdName}! (variant) | welcomeMessage (limited_member path) — messages.ts:99 | limited_member (child/teen) joins | Very brief; no mention of personal budget or wishlist | Warm, age-appropriate, mentions personal budget + wishlist | PENDING | PGS-010 | |
| C6 | {memberName} הצטרפ/ה לבית כ{roleLabel}. | joinNotificationMessage — messages.ts:147 | Admin notified when member joins | Functional and appropriate | No change | KEEP | — | |
| C7 | Role-aware help examples | helpMessage — messages.ts:307 | User sends /עזרה | May need update after product framing changes | Review after C1-C5 are approved | PENDING | PGS-010 or follow-on | |

---

## Section D — Inline String Violations (Code Quality — Not Part of Current Releases)

These Hebrew strings are hardcoded in server.ts or handlers.ts instead of being
centralized in messages.ts. They violate the project's centralization rule but do NOT
affect users today. Do NOT include these in PGS-001 through PGS-010 scope.
Extract to messages.ts in a separate future chore branch.

| Location | Abbreviated String | Context |
|----------|--------------------|---------|
| server.ts:743 | הרשימה ריקה — אין פריטים פעילים | Empty shopping list WhatsApp reply |
| server.ts:1313 | לא הצלחנו להוריד את התמונה... | Media download failure |
| server.ts:1393 | ההוצאה הועברה לפרויקט... | Project reassignment confirmation |
| server.ts:1416 | אין בקשה ממתינה לאישור | No pending approval |
| server.ts:1579 | לא הצלחתי לעבד את ההבהרה... | Clarification processing failure |
| server.ts:1609 | הבנת שפה טבעית לא מוגדרת... | NLP config missing |
| server.ts:1871 | כדי לא לרשום משהו לא נכון... | LLM quota exhausted |
| server.ts:1881 | לא הצלחתי להבין את ההודעה... | Dispatcher fail-safe |
| server.ts:1904 | כבר רשמתי את זה עכשיו | Duplicate expense reply |
| server.ts:1911 | נשארו X ש"ח לתקציב החודשי | Expense reply with balance |
| server.ts:1919 | מה תרצה להוסיף לרשימת הקניות? | Shopping list clarification |
| server.ts:1953 | הגעתם למגבלת סריקות הקבלות... | Receipt scan limit |
| handlers.ts | ~15 additional strings | See nlp/handlers.ts |

---

## Section E — Owner Approval Checklist

Mark each item: **APPROVED AS-IS** / **APPROVED WITH CHANGES** / **NEEDS REDESIGN** / **KEEP**

| ID | Description | Current Status |
|----|-------------|----------------|
| A1 | App brand name in header (AppShell) | PENDING |
| A2 | Browser title | PENDING |
| A3 | Browser meta description | PENDING |
| A4 | Login dev inbox status message | APPROVED — obvious fix (PGS-003) |
| A5 | Login dev inbox link | APPROVED — remove (PGS-003) |
| B2 | Open Graph metadata | PENDING |
| C1 | First WhatsApp welcome message | PENDING |
| C2 | Post-household setup message | PENDING |
| C3 | Dashboard hint message | PENDING |
| C4 | Adult member join welcome | PENDING |
| C5 | Limited member join welcome | PENDING |
| C7 | Help message | PENDING — review after C1-C5 |

---

*Hebrew text in this document is written in normal logical order for visual review.*
*Registry verified against live codebase on 2026-05-31.*

---

## Integration & QA Verification (2026-05-31 — Release Integration & QA Orchestrator)

Final per-item implementation status after integrating `release/stabilization-1` +
`release/product-copy-1` into the QA branch `qa/stabilization-product-copy-integration`
(frontend) and verifying the backend `chore/pgs-008-010-whatsapp-copy` copy.

**Approved copy (owner-confirmed working statement):**
- Brand: **Pingtally** · Short Hebrew display name: **קופה משפחתית**
- Slogan: **פחות ניהול. יותר משפחה.**
- Supporting sentence: **הוצאות, קניות, פרויקטים ובקשות מהילדים, הכל מתנהל בוואטסאפ.**
- Browser title: **Pingtally | פחות ניהול. יותר משפחה.**
- Meta description: **Pingtally עוזר למשפחות לנהל הוצאות, קניות, פרויקטים ובקשות מהילדים דרך וואטסאפ, עם דשבורד משפחתי פשוט וברור.**

**Frontend per-item status (verified in the integrated build — 24 routes, typecheck + build clean):**

| ID | Final status | Verified location |
|----|--------------|-------------------|
| A1 | IMPLEMENTED — brand now `קופה משפחתית` | `apps/web/src/components/AppShell.tsx:53` |
| A2 | IMPLEMENTED — title now approved copy | `apps/web/src/app/layout.tsx` (`metadata.title`) |
| A3 | IMPLEMENTED — meta description approved copy + OG tags added | `apps/web/src/app/layout.tsx` (`metadata.description` / `openGraph`) |
| A4 | IMPLEMENTED — Dev-inbox status removed; success = `הקישור בדרך אליכם 📩 פתחו את וואטסאפ והיכנסו בלחיצה.` | `apps/web/src/app/login/page.tsx` |
| A5 | IMPLEMENTED — Dev-inbox link removed (no `/dev-inbox` href in UI; only non-rendered code comment remains in AppShell) | `apps/web/src/app/login/page.tsx` |
| A6→login title | IMPLEMENTED — login title now `נכנסים דרך וואטסאפ` (+ hero `פחות ניהול. יותר משפחה.` + supporting sentence + chips) | `apps/web/src/app/login/page.tsx` |
| A7 (phone input) | IMPLEMENTED via PGS-005 — country-code selector (+972 default) + local field + leading-0 strip + dir="ltr"; button lockout after success; `next` param preserved (Suspense) | `apps/web/src/app/login/page.tsx` |
| B2 | IMPLEMENTED — OG title/description/locale present | `apps/web/src/app/layout.tsx` |
| members copy | IMPLEMENTED — `מוסיפים בן משפחה`; sent-confirmation + non-leaking error | `apps/web/src/app/settings/members/page.tsx` |

**Backend WhatsApp per-item status (`chore/pgs-008-010-whatsapp-copy`):**

| ID | Final status | Location |
|----|--------------|----------|
| C1 (PGS-008) | IMPLEMENTED — `onboardingInvitationMessage` = Pingtally intro (≤6 lines incl. link) | `apps/api/src/messages.ts` (`onboardingInvitationMessage`) |
| C2/C3 (PGS-009) | IMPLEMENTED — `onboardingCompletedMessage` (`הבית מוכן 🎉` + examples + `כתבו עזרה`) + `onboardingDashboardHintMessage` | `apps/api/src/messages.ts` |
| C4/C5 (PGS-010) | IMPLEMENTED — role-split `welcomeMessage` (owner / adult / limited_member) with optional `inviterName` | `apps/api/src/messages.ts` |
| C7 (help) | KEEP — `עזרה`/`help` wired to role-aware `helpMessage` | `apps/api/src/server.ts:1595` → `helpMessage()` |

**Decision — "שלחו 1" tour promise → REMOVED (PGS-011 follow-up).** The approved copy
promised `שלחו 1` for a product tour, but no tour message exists and no inbound handler
routes a bare `1` to one. `1` is overloaded (approval, project nudge, expense-type
choice), and the most prominent promise was in `onboardingInvitationMessage`, sent
**pre-onboarding** — at that point an inbound `1` only re-sends the invitation
(`apps/api/src/server.ts:1258-1291`), so it is structurally unwireable without redesigning
the pre-onboarding flow. The promise was removed from the owner welcome,
`onboardingCompletedMessage`, and `onboardingInvitationMessage`; legitimate wired
`שלח 1` approval/project prompts are untouched. **PGS-011** (design + wire a real product
tour) is logged in the stabilization plan.

**Testing notes:** Frontend typecheck + build clean (24 routes + middleware 34 kB).
Backend typecheck clean; full suite **18 failed / 219 passed (237)** — byte-identical to the
pre-edit baseline (the 18 are pre-existing, environment/integration-dependent: admin-cookie,
Postgres persistence, LLM-dispatcher conversation, weekly-summary). Copy edits introduced
**zero** new failures. Real 375×812 browser smoke on the integrated state remains an
owner/operator action (not runnable in this headless environment).

---

## Preview QA Copy Remediation (2026-05-31 — Preview QA & Final Owner Review Agent)

Final Preview QA surfaced two **pre-existing** copy conflicts (already on production main, not
introduced by stabilization-1 / product-copy-1). Owner approved fixing both.

| New ID | Surface | Current (before) | Now (after) | File | Commit |
|--------|---------|------------------|-------------|------|--------|
| PGS-013 | `/shopping-list` route strip | `מסלול בסופר` + `הקטגוריות לפי סדר ההליכה` (claims supermarket-walking-order sort) | `לפי קטגוריות` + `הרשימה מקובצת לפי קטגוריות`; entrance/checkout store dots removed; category chip strip kept | `apps/web/src/app/shopping-list/page.tsx` | `385d50d` (qa branch) |
| PGS-012 | Trial/subscription WhatsApp | `עוזר הקניות` / `עוזר הקניות המשפחתי` in `trialDay7` / `trialEnded` / `subscriptionExpired` | Pingtally framing | `apps/api/src/messages.ts` | `d03c521` (backend chore branch, local-only) |

**Note:** product-copy-1 had already removed the supermarket-order claim from the shopping-list
*empty state*; PGS-013 closes the matching claim in the *populated-state* route strip that was
missed. After both fixes: frontend typecheck + build clean (24 routes); backend typecheck
clean, suite 18 failed / 219 passed (237) = baseline, 0 new. The real 375×812 + 1280×800
browser smoke remains the one open owner-action gate.
