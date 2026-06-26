# App Redesign — full Claude Design implementation pass

Branch: `feat/app-redesign-settings-ia`. Acceptance contract = `design_handoff_pingtally_app/README.md` §3 A–N + §4/§5 + §10.
Phase-1 coverage matrix: see git history / session. This doc is the live working checklist.

## Owner decisions (2026-06-26)
1. **Backend scope:** implement ALL 6 needed contracts, migration-free where possible. Isolated, tested, NOT deployed without owner sign-off.
2. **Insights periods:** extend backend so the full `השבוע / החודש / החודש שעבר` selector works for real.
3. **Mobile nav:** rebuild to the design's right-side off-canvas drawer + hamburger top bar (replace the bottom-tab + "עוד" sheet).

## Backend contracts (Shopping assistant repo — isolated, tested, no prod deploy)
- [ ] C  PATCH `/households/:id/financial-baseline/alerts` (manager-gated; merges into baseline.alerts)
- [ ] H  per-project `spent` on `listProjectBudgets` (derive from purchases.project_budget_id; no migration)
- [ ] I  period `week|month|prevMonth` on spending/by-member + by-weekday (+ monthly insight stack + weeks-of-month trend)
- [ ] J  shopping "bought this month": scope purchased items to current month via existing `updatedAt` (no migration)
- [ ] K  POST `/wishlist` accepts `ownerUserId` (owner/admin only; target must be limited_member of same household)
- [ ] N  relax required region/defaultCity in onboarding quick mode
- [ ] backend typecheck + full test suite green; `pnpm sync:shared`; shared-types + api-client byte-identical

## Frontend — shared shell (do first; many screens depend on it)
- [ ] tokens.css: add type-scale tokens, `.display`, `--r-pill`, `--dur-bar` (no visual change; parity)
- [ ] AppShell: rail 264px, brand mark + "Pingtally" sub-label, active weight 700
- [ ] Nav → exactly 6 (merge תובנות + ניתוח → "תובנות וניתוח"; remove /family/pulse item) — coupled to merged Insights screen
- [ ] Mobile: hamburger sticky top bar (brand centered) + right off-canvas drawer + scrim; identity+logout in drawer; ≥44px targets; breakpoint 900px

## Frontend — per-route screens
- [ ] H  Dashboard: remove refresh + role chip + household name from header; greeting + "הנה מה שקורה בבית החודש"; projects "הוצא {spent}/{budget}" + real bar; Hebrew date (no raw ISO)
- [ ] I  NEW merged `תובנות וניתוח`: tabs סיכום/ניתוח + 3-period selector; retire /insights + /family/pulse
- [ ] J  Shopping: split "לקנות" vs collapsible "נקנו החודש" (month-scoped, collapsed default); remove off-spec view-toggle + route-strip; copy fixes
- [ ] K  Wishlists empty state: WhatsApp copy + "הזמינו את הילדים" + "הוספת משאלה ידנית" (functional) + 3-step how-it-works
- [ ] N  Onboarding: gate cars/kid-ages/region (home) + freq-picker/change-alert (fixed) on precise; income-count ChipSelect
- [ ] B  Household: MoneyInput + DayChips; single dirty Save bar; manager-gate the VIEW (no budget leak to limited); income-mode label/hints; StatTile emphasis
- [ ] C  Notifications: reuse shared NotificationsEditor as the onboarding final step; wire real PATCH persistence (immediate toggles); active-count chip; WhatsApp glyph
- [ ] E  Members: pending-invite ("הזמנות שנשלחו") section + cancel; role chip; phone mono; WhatsApp invite banner; role-card check affordance
- [ ] A  Settings hub: fix meta-pill order (members·plan·region); gate the billing-plan pill (no leak to limited/adult); receipts copy
- [ ] D  Category budgets: add-category affordance or in-file deferral note; StatTile teal highlight; cross-link Info icon in summary panel
- [ ] G  Billing: "מומלץ למשפחה שלכם" chip + "חיסכון 17%" + "המסלול שלכם" copy + monthly-equivalent price + 3-up grid. Export: "הורדת CSV" + tinted column box + limited gate.
- [ ] F  Receipts: WhatsApp brand glyph + coral retry button + receipt-thumb (cosmetic)
- [ ] M  Em-dash sweep: replace all 33 user-facing U+2014/U+2013 with hyphen; add a regression guard test

## Verification gates (before QA push)
- [ ] frontend typecheck + build + unit/component tests
- [ ] Playwright authenticated smoke, role matrix (owner/admin/adult/limited), 375×812 + 1280
- [ ] desktop + mobile screenshots for every redesigned route; no overflow, no 5xx, no console errors, no client-secret leak
- [ ] privacy smoke (limited_member fetches nothing household-only); shared-contract audit; git/github audit
- [ ] adversarial critic pass; final owner report; then /handover
