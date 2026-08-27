# SEPACCT — the wire, for the frontend

**Written 2026-08-27 by the backend side, at the end of track B run 7.** Read-only description of
what the API serves. Nothing was written to `Family-budget-web` — another agent owns that
repository. Every shape below was read out of `apps/api/src/household-routes.ts` and
`packages/db/src/sepacct.ts` in this session.

## The state you are inheriting

`apps/web/src/lib/sepacctMock.ts` exists, and four pages are built against it:

| Page | Mock methods it calls |
|---|---|
| `settings/separate-accounts` | `getConfig`, `saveConfig` |
| `shared-expenses` | `getAllocation`, `setAllocation`, `disputeMyShare` |
| `my-income` | `getOwnIncome`, `saveOwnIncome` |
| `my-record` | `getRecordComponents` |

**All four have real routes behind them.** None of the four has ever spoken to one.

⚠️ **The mock is NOT the wire.** Eight named differences are listed at the end, and three of them
change what a page has to fetch, not just how it reads a field. Read that section before you start.

---

## Conventions that hold on every route below

- **Base:** `/api/v1`. Every path here is under it. `:householdId` is a UUID.
- **Money is always an INTEGER number of AGOROT.** Never a decimal, never a string, never ILS.
  `9335` is ₪93.35. The division by 100 happens in your formatter and nowhere else. The API never
  sends a formatted string and never sends a float.
- **Shares are integer BASIS POINTS.** `shareBp: 5000` is 50%. `10000` is the whole. A valid split
  sums to exactly `10000`.
- **`amountAgorot` on a settlement is ALWAYS POSITIVE.** Direction is carried by `fromUserId` and
  `toUserId`, never by a sign. Do not render a minus.
- **Dates are `YYYY-MM-DD` strings** (`purchaseDate`, `occurredOn`, the `from`/`to` params).
  Instants are ISO-8601 strings (`disputedAt`, `createdAt`, `windowOpenedAt`).
- **Auth** is the existing session; mutating routes take the existing CSRF treatment. Nothing
  SEPACCT-specific.
- **Errors** are the existing `DomainError` envelope — a stable `code` plus a message. The codes you
  will actually meet are named per route.

### ⛔ The dormant shape, and it is the same on every route

**With its flag off, every SEPACCT route returns `404` with code `http.not_found`** — not `403`, not
an empty body, not a feature-detection payload. That is the *registered-but-disabled* convention
this codebase uses everywhere.

**All seven flags are OFF today, so every route in this document 404s in production right now.**

> 🔑 **Design for it: a 404 from these routes means "not turned on", not "you did something wrong".**
> It is indistinguishable at the wire from a genuinely missing resource, and that is deliberate — a
> child and a disabled feature must look the same. Render the feature as **absent**, not as an
> error, and never show a retry.

### The one exception, and it is a trap

`GET /households/current/separate-accounts` **used to** return code `sepacct.not_enabled` while the
other seven returned `http.not_found`. **That was normalised — all eight now return
`http.not_found`.** If you are reading an older `API_CONTRACT_FOR_CLAUDE_CODE.md` that says
otherwise, this document is newer.

### A child (`limited_member`) never sees any of this

Where a route could distinguish "forbidden" from "absent", it deliberately chooses **absent**: a
child gets `404`, not `403`, on the split and component routes. Do not build a "you don't have
permission" state for them. `GET …/my-income` is the one that answers rather than 404s, and it
answers `{ "monthlyAgorot": null }`.

---

## 1 · The arrangement — `settings/separate-accounts`

### `GET /households/current/separate-accounts`
Flag: **`HOUSEHOLD_SEPARATE_ACCOUNTS_ENABLED`** · Off ⇒ `404 http.not_found`

⚠️ **`current`, not `:householdId`** — this is the only SEPACCT route keyed that way. The `PUT` below
*is* keyed by id. That asymmetry is real; do not "fix" it by guessing.

Only a household **manager** (owner / admin / co-manager) may call it. Anyone else: `403 auth.forbidden`.

```jsonc
{
  "separateAccounts": true,                 // boolean, never null
  "members": [                              // ACTIVE members only, adults and children alike
    { "userId": "uuid", "displayName": "נועה", "role": "owner" }
  ],
  "defaultSplit": [                         // [] when never configured
    { "userId": "uuid", "shareBp": 5000 }
  ]
}
```
- `role` is one of `owner` | `admin` | `adult_member` | `limited_member`.
- `displayName` may be `""`. Have a fallback.
- `members` includes children; `defaultSplit` may **not** name one.

### `PUT /households/:householdId/separate-accounts`
Same flag, same manager-only rule. Body:
```jsonc
{ "separateAccounts": true, "defaultSplit": [ { "userId": "uuid", "shareBp": 5000 } ] }
```
Returns the same body as the `GET`.

**Validation, and each has its own code:**

| Condition | Status | Code |
|---|---|---|
| `separateAccounts` not a boolean, or `defaultSplit` not an array | 400 | `split.invalid` |
| a `shareBp` that is not an integer in `0…10000`, or a duplicate `userId` | 400 | `split.invalid` |
| `separateAccounts: true` with an empty split, or one not summing to exactly `10000` | 400 | `split.invalid` |
| a `userId` that is not an **active, non-child** member | 400 | `split.not_a_member` |

> The sum rule applies **only when `separateAccounts` is `true`.** Turning the arrangement off with
> a stale or empty split is accepted — do not block that in the UI.

---

## 2 · One expense's split — `shared-expenses`

All three routes: flag **`HOUSEHOLD_SEPARATE_ACCOUNTS_SPLITS_ENABLED`** · Off ⇒ `404 http.not_found`

### `GET /households/:householdId/purchases/:purchaseId/split`
```jsonc
{
  "purchase": {
    "id": "uuid",
    "merchantNameRaw": "סופר השכונה",   // may be null
    "purchaseDate": "2026-08-24",
    "userId": "uuid"                     // who recorded it; may be null
  },
  "allocation": {                        // null when this purchase has no split rows
    "purchaseId": "uuid",
    "totalAgorot": 18670,
    "shares": [
      { "userId": "uuid", "shareBp": 5000, "agorot": 9335,
        "previousShareBp": null,         // the share before the last edit, or null
        "disputedAt": null }             // ISO instant, or null
    ]
  }
}
```
- **`allocation: null` is normal**, not an error — §3.4, an expense with no split rows.
- 🔴 **`shares[].agorot` is resolved by the server and you must render it verbatim.** Do **not**
  recompute it from `shareBp × totalAgorot`. The remainder agora is distributed by a rule
  (`shareBp` descending, `userId` ascending) whose result you cannot reproduce from these fields
  alone, and the parts are asserted to sum to the whole on the server. Recomputing loses money on
  screen.
- 🔴 **There is no `displayName` here.** The mock has one; the wire does not. Join `userId` against
  the arrangement's `members`.
- Child caller: `404 split.not_found`.

### `PUT /households/:householdId/purchases/:purchaseId/split`
Body `{ "shares": [ { "userId": "uuid", "shareBp": 5000 } ] }`. Returns the same body as the `GET`.

| Condition | Status | Code |
|---|---|---|
| caller is a child | 403 | `split.child_excluded` |
| caller is neither the payer nor a manager | 403 | `auth.forbidden` |
| purchase missing, or in another household | 404 | `purchase.not_found` |
| `shares` is not an array | 400 | `split.invalid` |

### `POST /households/:householdId/purchases/:purchaseId/split/dispute`
Marks **the caller's own** share disputed. Takes no body.

🔴 **It returns NOTHING — an empty body, not the updated allocation.** The mock returns the
allocation. Re-`GET` the split after a successful dispute.

---

## 3 · Income — `my-income`

Flag: **`HOUSEHOLD_SEPARATE_ACCOUNTS_INCOME_ENABLED`** · Off ⇒ `404 http.not_found`

### `GET /households/:householdId/my-income` → `{ "monthlyAgorot": 1825000 }`
`null` when unset **and** `null` for a child. **Self only** — there is no route, at any role, that
serves another member's income. Do not build one; a manager cannot see it either.

### `PUT /households/:householdId/my-income`
Body `{ "monthlyAgorot": 1825000 }` or `{ "monthlyAgorot": null }` to clear. Returns the `GET` body.
Anything that is not `null` or a **non-negative integer** ⇒ `400 income.invalid`. A float fails;
send agorot.

---

## 4 · My record — `my-record`

🔴 **THIS PAGE NEEDS TWO REQUESTS, NOT ONE, AND THE SPLIT BETWEEN THEM IS DELIBERATE.** The mock's
`getRecordComponents()` returns `{ recordedAgorot, shareAgorot, entries }` from one call. On the
wire the two totals and the itemised list come from **different routes with different time
windows**, and merging them would produce a number that is wrong.

### `GET /households/:householdId/my-record-components?from=&to=`
Flag: **`HOUSEHOLD_SEPARATE_ACCOUNTS_SPLITS_ENABLED`** · The **itemised list**, over a
caller-supplied window on **`purchaseDate`**.

⚠️ **`from` and `to` are REQUIRED.** Both must be `YYYY-MM-DD` and `from <= to`, or `400 split.invalid`.

```jsonc
{ "entries": [
  { "purchaseId": "uuid", "merchantNameRaw": "סופר השכונה", "purchaseDate": "2026-08-24",
    "recordedAgorot": 18670,   // the whole expense
    "myShareAgorot": 9335,     // the caller's share of it
    "disputedAt": null }
] }
```

### `GET /households/:householdId/my-components`
Same flag. The **two totals** — and it takes **no range parameter at all.**

```jsonc
{
  "recordedAgorot": 250000,
  "shareAgorot": 187000,
  "settledOutAgorot": 0,      // always present; 0 while SETTLE is off
  "settledInAgorot": 0,
  "windowOpenedAt": null      // ISO instant, or null for "all of history"
}
```

**Why no range:** these are the components of the **position**, whose window is fixed at
`(watermark, now]` on **when the obligation was RECORDED** — not on `purchaseDate`. A caller-supplied
range here would return two numbers that look like components of a position and are not.

> ⛔ **THE ONE RULE THAT MATTERS MOST ON THIS PAGE: NEVER SUBTRACT THESE FIELDS.**
> Do not render `recordedAgorot − shareAgorot`. Do not label anything "owed", "balance", "owes you",
> "יתרה" or "חוב". Do not colour one red and one green. Do not sort by, chart, or total the
> difference. The product serves **components, never a net** — there is exactly one authorised place
> a net may appear, it is a WhatsApp line behind its own flag, and it is not this page. Two fields
> is not an oversight to work around; **the absence of a third is the feature.**

> 🔑 **`windowOpenedAt` is not decoration.** Non-null means these totals **start** at that instant —
> the member left and rejoined, or was removed and restored, and everything before it is
> deliberately excluded. **If it is non-null you must say so on the same surface**, or you are
> showing a smaller pair of numbers with nothing explaining why. The frozen amount itself is a net
> and is deliberately not served. Copy is yours; a phrasing like *"מוצג מ־&lt;date&gt;"* is the shape.

---

## 5 · What has routes and NO surface at all

You asked which of the four surfaces has no route. **The answer is none — all four have routes.**
The gap runs the other way: **stage 5 shipped a complete backend with no web surface whatsoever.**

Both routes: flag **`HOUSEHOLD_SEPARATE_ACCOUNTS_SETTLE_ENABLED`** · Off ⇒ `404 http.not_found` ·
Child ⇒ `404`

### `GET /households/:householdId/settlements` → `{ "entries": [ Settlement, … ] }`
### `POST /households/:householdId/settlements` → one `Settlement`

```jsonc
// Settlement
{ "id": "uuid", "householdId": "uuid",
  "fromUserId": "uuid", "toUserId": "uuid",
  "amountAgorot": 40000,        // ALWAYS POSITIVE; direction is the two ids
  "occurredOn": "2026-08-26",   // what the humans say; DISPLAY ONLY, never a window bound
  "method": null, "note": null, // strings or null
  "recordedBy": "uuid",
  "createdAt": "2026-08-26T09:15:00.000Z" }   // the RECORDING instant — this is the window bound
```

`POST` body: `fromUserId`, `toUserId`, `amountAgorot`, `occurredOn` required; `method`, `note`
optional strings.

| Condition | Status | Code |
|---|---|---|
| caller is a child | 403 | `settlement.child_excluded` |
| caller is neither party nor a manager | 403 | `auth.forbidden` |
| a required field missing or of the wrong type | 400 | `settlement.invalid` |
| `from === to`, non-positive or non-integer amount, malformed date | 400 | Hebrew refusal |

**There is no counterparty confirmation** (owner decision #37). Either party records it, and so may
a manager. Today the only way a user can create one is **WhatsApp**, behind the same flag.

⚠️ **A settlement is never an expense and never income.** It appears in **no** budget total, no
category breakdown and no member breakdown, by construction. Do not add it to one on the client.

---

## 6 · THE EIGHT PLACES THE MOCK AND THE WIRE DISAGREE

| # | Mock | Wire | What it costs you |
|---|---|---|---|
| 1 | `SplitShareDto.displayName` | **absent** — `userId` only | join against the arrangement's `members` |
| 2 | `getRecordComponents()` → totals **and** entries in one call | **two routes**, `my-components` (totals, no range) and `my-record-components` (entries, range **required**) | two fetches, two windows, and they are not the same window |
| 3 | `getAllocation()` takes no purchase | the split route needs a **`purchaseId`** | the list of purchase ids comes from `my-record-components` |
| 4 | `disputeMyShare()` returns the allocation | returns **nothing** | re-`GET` after a dispute |
| 5 | `merchantName` | **`merchantNameRaw`**, and it can be `null` | rename, and add a fallback |
| 6 | `PurchaseAllocationDto.recordedBy` is a display name | `purchase.userId`, a UUID, nullable | join, and handle null |
| 7 | no `windowOpenedAt` | present on `my-components`, **load-bearing** | new UI state — see §4 |
| 8 | no `settledOutAgorot` / `settledInAgorot` | always present on `my-components`, `0` while SETTLE is off | render them, and **do not net them** |

## 7 · Two things nobody has decided, and they are yours to raise

- **The fixed-expense preset catalogue is a frontend decision.** The backend has no preset catalog:
  `sourcePresetId` is validated as a free string with **no allow-list**, and the backend's
  `categoryConcepts` lexicon only *classifies* what already exists. Spec §10 says a flat-share
  should be offered rent and utilities rather than `daycare`/`school`/`classes` — **that ruling has
  no backend surface to land on and will have to live in your repository.**
- **Stage 5 has no web surface** (§5). Whether settlements get a page, or stay WhatsApp-only, is a
  product decision nobody has made. The routes are there either way.
