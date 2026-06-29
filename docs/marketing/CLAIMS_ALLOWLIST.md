# Pingtally — Marketing Claims Allowlist

**Scope:** every user-facing claim on the public marketing surfaces (`/` and
`/login`, i.e. `apps/web/src/components/marketing/**`, plus the landing metadata
and JSON-LD). This is the single source of truth for what we may and may not say.

**Status:** authoritative as of the `feat/public-root-landing-pingtally` landing
implementation. Derived from the owner-reviewed design package
(`Family budget app.zip → owner-review-exports/FINAL_OWNER_REVIEW_NOTES.md`,
Revision 3 trust-claims audit) and reconciled against the real product behaviour
in this repo. **Mark: design-verified + copy-gated; some items still need owner
/ backend confirmation (see "Careful" and "Owner-confirm").**

---

## 1. Safe claims (approved, in use)

These are true of the product as built and may be used freely.

| Claim (Hebrew on page) | Why it is safe / evidence |
|---|---|
| אין חיבור לבנק / בלי לחבר חשבון בנק | Pingtally has no bank-link integration; expenses are user-submitted. |
| Pingtally לא מתחבר לכרטיס האשראי כדי לקרוא עסקאות | No card-transaction ingestion exists; card is only a future subscription payment method. |
| בלי כרטיס אשראי כדי להתחיל / להתחלה | The 20-day trial requires no card. **Always scope to start/trial — never bare "בלי כרטיס אשראי".** |
| אתם בוחרים מה לשלוח | Users send expense / receipt / list item / budget explicitly. |
| ילדים מוסיפים בלי לראות את התקציב | Role model: `limited_member` can add but cannot read household budget (enforced server-side, 403). |
| הוצאות אישיות נשארות אישיות | `expense_type='personal'` is filtered from shared/household views and the activity feed. |
| כל אחד רואה רק את מה שמותר לו | Per-member roles/permissions (owner / admin / adult_member / limited_member). |
| קבלות עוברות קריאה ואישור קצר | Receipt OCR proposes; the user confirms before save. |
| כניסה מאובטחת וחיבור מוצפן | In-transit encryption (HTTPS) + verified login. **In-transit only — see Blocked.** |
| התקשורת ביניכם לבין השירות מוצפנת, והגישה לדשבורד דורשת כניסה מאומתת | Precise in-transit + verified-access wording. The approved detailed phrasing. |
| הדשבורד נפתח רק אחרי כניסה מאומתת | Client `/me` guard + server auth; dashboard is not public. |
| AI עוזר לקרוא קבלות ולסווג הוצאות, אבל לא נותן ייעוץ פיננסי | AI is OCR + categorization assist only; no advisory output. |
| המידע לא נמכר לאף אחד | No data sale / third-party ad use. |
| קישור הכניסה תקף ל-15 דקות | **Owner-verified** magic-link TTL. (The old `/login` said "10 דקות"; corrected to 15 here.) |
| כניסה בוואטסאפ, בלי סיסמה | Magic-link via WhatsApp; no password. |
| 20 יום ניסיון / אפשר לבטל בכל רגע / המחירים כוללים מע״מ | Trial + cancel + VAT-inclusive pricing. |
| מחיר אחד לחשבון, לא לכל משתמש | Account-level pricing. |
| "אוטומטי" — only for categorization | e.g. "מסדר את זה במקום הנכון". Allowed ONLY to describe sorting/categorization. |

---

## 2. Careful claims (allowed now, with caveats — revisit)

| Claim | Caveat / required follow-up |
|---|---|
| "פינג" as the assistant persona | Used in marketing copy + the hero mock. The **live WhatsApp bot replies are not yet aligned** to the "פינג" name. Follow-up: make "פינג" the real bot name before presenting it as current live behaviour. Do not claim the bot greets users by first name today. |
| First-name personalization | NOT a current landing claim. Do not add until the bot actually personalizes. |
| AI wording | Keep AI secondary and assistive ("עוזר לקרוא ולסווג"). Never imply AI decides or advises. |
| Deletion ("אפשר לבקש מחיקת חשבון") | Deletion is **request-based**, not one-click self-serve. Keep the "לבקש" (request) framing + the legal-retention caveat. |
| Hero/dashboard mock numbers | Illustrative marketing art (fictional round numbers, the "פינג" transcript). NOT live data and NOT bound to the real 7-category backend enum. Keep static. |

---

## 3. Owner-confirm (gated — verify before/at go-live)

- **Final prices** (₪19.90 / ₪29.90 / ₪39.90 monthly; ₪199 / ₪299 / ₪399 yearly).
  These mirror the backend `PLAN_PRICEBOOK`. A price change is a backend deploy
  **and** an edit to `PricingPlans.tsx` + the JSON-LD offers. Keep them in sync.
- **Billing-flow status** at end of trial (the page promises no card to start and
  cancel-anytime; it makes **no** promise to remind before a charge).
- **Personal-expense privacy** wording — keep only while the role model enforces it
  (it does today, server-side).

---

## 4. Blocked claims (never use)

These are forbidden on any marketing surface. A grep gate (below) guards them.

- `נזכיר לפני כל חיוב` / any "we'll remind you before charging" promise — **removed entirely.**
- `הכל אוטומטי` / `הכל נרשם אוטומטית` / `הקבלה נרשמת לבד` — no "everything automatic" / "logs itself" self-claim. ("אוטומטי" is allowed only for categorization, and only to describe the *other* category in the comparison, e.g. "דוח אוטומטי בדיעבד".)
- `פינג לומד את ההרגלים שלכם` — no habit-learning claim.
- `AI לא רואה את הנתונים` — do not claim the AI cannot see data.
- "no one can see your data" / `אנונימי לחלוטין` (fully anonymous) — false.
- `מאובטח מקצה לקצה` / end-to-end encryption — Pingtally does not provide E2EE.
- At-rest encryption claims — out of scope / unverified.
- `מאובטח ברמת בנק` / bank-level / military-grade security — unsupported.
- ISO / SOC2 / PCI or any certification — none held.
- "data not used to train models" (`לא משמש לאימון`) — only if separately verified and attributed; not asserted today.
- `נקראת בעבר גם "קופה משפחתית"` as a footer rebrand line — confusing. `קופה משפחתית`
  may appear ONLY as a natural SEO phrase + schema `alternateName`, never as the brand
  or a "formerly called" statement.
- Bot addresses the user by first name "today".

---

## 5. Rules for future copy edits

1. **Every new marketing string must map to a Safe row here, or be added to this file first.** If it touches trust / security / privacy / AI / pricing / automation, it is high-risk — get explicit confirmation.
2. **Hyphens only.** No em-dash (`—`) or en-dash (`–`) anywhere in source — enforced by `apps/web/src/lib/noEmDash.test.ts`.
3. **Scope credit-card mentions** to start/trial ("...כדי להתחיל"). Never bare "בלי כרטיס אשראי".
4. **"אוטומטי" is categorization-only.** Never a whole-product or receipt-logging self-claim.
5. **Encryption = in-transit + verified-access only.** Never E2EE / at-rest / bank-level / certifications.
6. **Prices live in two places** (`PricingPlans.tsx` + `LandingJsonLd.tsx`) and must equal the backend `PLAN_PRICEBOOK`. Change all three together.
7. **`קופה משפחתית`** stays in metadata / schema `alternateName` / natural SEO sentence / FAQ only — never as the brand.

### Grep gate (run before any landing merge)

```sh
# Expect zero hits in apps/web/src/components/marketing + landing routes:
grep -rn "נזכיר לפני כל חיוב\|מקצה לקצה\|AI לא רואה\|נקראת בעבר גם\|הכל אוטומטי\|נרשם אוטומטית\|נרשמת לבד\|לומד את ההרגלים" apps/web/src/components/marketing apps/web/src/app/page.tsx apps/web/src/app/login/page.tsx apps/web/src/app/layout.tsx
# And no bare "בלי כרטיס אשראי" without a start/trial qualifier.
```
