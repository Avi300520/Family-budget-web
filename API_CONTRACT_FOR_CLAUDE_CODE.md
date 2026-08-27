# Separate-accounts API contract

> ⚠️ **SUPERSEDED by `SEPACCT_FRONTEND_SPEC.md`** (2026-08-27), which the backend side wrote
> from the routes as implemented. Where the two differ the spec wins - it already carries the
> normalisation this document predates (all eight routes now answer `404 http.not_found` when
> their flag is off, including the one described below as `sepacct.not_enabled`).

All paths are under `/api/v1`. Every route requires the authenticated web session and uses the
existing CSRF protection for mutations. Amounts labelled `*Agorot` are signed or unsigned integer
agorot, never floats. ISO timestamps are UTC strings.

## 1. Read the household arrangement

`GET /households/current/separate-accounts`

Roles: `owner`, `admin`, and `adult_member` with `permissions.all === true`. A non-manager gets
`403 { error: { code: "auth.forbidden", message: string } }`.

```json
{
  "separateAccounts": true,
  "members": [{ "userId": "uuid", "displayName": "string", "role": "owner" }],
  "defaultSplit": [{ "userId": "uuid", "shareBp": 5000 }]
}
```

Field sources: `separateAccounts` and `defaultSplit` come from `Household.financialBaseline.profile`
returned by `packages/db/src/postgres-store.ts:getHousehold`; membership `userId` and `role` come
from `packages/db/src/postgres-store.ts:listMembers`. `displayName` is a request in the final
section - `HouseholdMember` has no name field.

`404 { error: { code: "http.not_found", message: string } }` when the feature flag is off. This
matches every dormant separate-accounts route and the repository's registered-but-disabled route
convention.

## 2. Save the household arrangement

`PUT /households/:householdId/separate-accounts`

Request:

```json
{
  "separateAccounts": true,
  "defaultSplit": [{ "userId": "uuid", "shareBp": 5000 }]
}
```

Response is route 1's body. Roles: household manager only. Validate active adult members only,
unique `userId`, integer `shareBp` 0..10000, and a non-empty set totalling exactly 10000 when
`separateAccounts` is true. Do not rewrite past `purchase_splits` rows.

The stored fields are the profile fields read by `getHousehold`; normalization and carry-forward
rules exist in `packages/db/src/interfaces.ts:normalizeFinancialBaseline` and
`carrySeparateAccounts`. A focused write method is requested below; do not route this UI through a
whole onboarding overwrite.

Errors: `400 split.invalid`, `400 split.not_a_member`, `403 auth.forbidden`, `404 household.not_found`,
and `404 http.not_found` when the flag is off.

## 3. Read one resolved expense split

`GET /households/:householdId/purchases/:purchaseId/split`

Roles: authenticated adult subject. A limited member receives `404 split.not_found` rather than
any allocation data. Response:

```json
{
  "purchase": {
    "id": "uuid",
    "merchantNameRaw": "string|null",
    "purchaseDate": "YYYY-MM-DD",
    "userId": "uuid|null"
  },
  "allocation": {
    "purchaseId": "uuid",
    "totalAgorot": 18670,
    "shares": [{ "userId": "uuid", "shareBp": 5000, "agorot": 9335, "previousShareBp": 6000, "disputedAt": "ISO|null" }]
  }
}
```

`allocation` is `null` for an unallocated expense. `allocation.purchaseId`, `totalAgorot`, and every
share field are returned by `packages/db/src/postgres-store.ts:getPurchaseSplits`, via
`packages/db/src/sepacct.ts:resolveAllocation`. The route must not calculate `agorot` in HTTP.
Purchase id, name, date, and recorded user id come from
`packages/db/src/postgres-store.ts:getPurchaseById` and must be tenancy-checked before return.

Errors: `404 purchase.not_found`, `404 split.not_found`, and `500 sepacct.impossible_state`.

## 4. Replace or clear one expense split

`PUT /households/:householdId/purchases/:purchaseId/split`

```json
{ "shares": [{ "userId": "uuid", "shareBp": 5000 }] }
```

An empty `shares` array deliberately clears allocation. Response is route 3's body. Roles: payer
or household manager, as enforced by the requested route guard and the store sink
`packages/db/src/postgres-store.ts:setPurchaseSplits`. Store-derived result fields are the same as
route 3.

Errors emitted by the existing sink: `400 split.invalid`, `400 split.not_a_member`,
`400 split.child_excluded`, `403 split.child_excluded`, `404 purchase.not_found`,
`409 split.no_payer`, and the freeze/mutability refusal returned by `assertPurchaseMutable`.

## 5. Mark my share disputed

`POST /households/:householdId/purchases/:purchaseId/split/dispute`

Body: empty. Response: `204`. Roles: the adult subject only. The write and its self-only identity
are `packages/db/src/postgres-store.ts:disputePurchaseShare`; `disputedAt` is then exposed by
route 3 from that method's `getPurchaseSplits` result.

Errors: `403 split.child_excluded`, `404 split.not_found`, `404 http.not_found`.

## 6. Read my own declared income

`GET /households/:householdId/my-income`

Response: `{ "monthlyAgorot": 1825000 }` or `{ "monthlyAgorot": null }`. No target member id is
accepted. The value is returned only by `packages/db/src/postgres-store.ts:getOwnIncomeAgorot`.
An authenticated limited member gets `{ "monthlyAgorot": null }` on this read.

## 7. Set or clear my own declared income

`PUT /households/:householdId/my-income`

Request `{ "monthlyAgorot": 1825000 }` sets the exact integer; `{ "monthlyAgorot": null }`
clears it. Response repeats route 6. The store sink is
`packages/db/src/postgres-store.ts:setOwnIncomeAgorot`.

Errors: `400 income.invalid`, `403 income.child_excluded`, `404 http.not_found`.

## 8. Read private recorded components

`GET /households/:householdId/my-record-components?from=YYYY-MM-DD&to=YYYY-MM-DD`

Roles: authenticated adult subject only. Response deliberately contains components and never a
net, direction, debt, credit, or conclusion field:

```json
{
  "entries": [{
    "purchaseId": "uuid",
    "merchantNameRaw": "string|null",
    "purchaseDate": "YYYY-MM-DD",
    "recordedAgorot": 18670,
    "myShareAgorot": 9335,
    "disputedAt": "ISO|null"
  }]
}
```

`recordedAgorot` is `Purchase.totalAmount` converted once per row by the same store allocation
logic, and `myShareAgorot` must be the resolved `AllocatedShare.agorot` from
`getPurchaseSplits`/`resolveAllocation`, never a browser calculation. Purchase metadata comes
from `getPurchaseById`; no existing public store method returns this joined private list, so this
route depends on request R3.

## 9. Read the approvals waiting on ME to decide

`GET /households/:householdId/pending-approvals`

Roles: `owner` and `admin` only - the set that may actually vote on a `limited_member`'s
household expense. An `adult_member` gets `403 { error: { code: "auth.forbidden" } }`, and so does
a `limited_member`; the child's own surface is the existing `GET /households/:householdId/my-requests`,
which is the exact inverse of this one.

```json
{
  "requests": [{
    "id": "uuid",
    "submitterName": "string",
    "amount": 137,
    "merchantNameRaw": "string",
    "submittedAt": "ISO",
    "expiresAt": "ISO"
  }]
}
```

`404 { error: { code: "http.not_found" } }` when `HOUSEHOLD_APPROVAL_PULL_ENABLED` is off, matching
every other dormant route here.

**Why this route exists, because it constrains what may be added to it.** The approval REQUEST is
already pushed to these same two roles over WhatsApp, naming the submitting member beside their
amount. That push is the one permitted exception to the rule that no message discloses one
member's spending to another - permitted because the recipient is the person whose decision the
flow is blocked on. Until now that audience had no pull surface at all, so the disclosure existed
only as a WhatsApp message on a channel that silently refuses cold recipients.

**The field list is the push's payload and nothing more.** There is deliberately no `submittedBy`
user id, no `category` and no `status`. A pull surface wider than the push it justifies makes that
exception bigger instead of accountable. Do not request additional fields here without a product
ruling; request them on a different route.

`amount` is the shekel figure the child typed, verbatim - **not** agorot, unlike every `*Agorot`
field elsewhere in this document. `submitterName` is resolved server-side as the member's display
name, falling back to their phone number when they have not set one; render it as given and do not
reconstruct it from a member list.

The list is the household's currently pending, unexpired requests, oldest first. A withdrawn or
expired request simply disappears from it - there is no tombstone, and the absence is the signal.

Store sink: `packages/db/src/postgres-store.ts:listPendingApprovalsForApprover`. No new table:
`pending_household_expenses` has existed since migration `0011`.

## Requests for store/API work

R1 - Add a focused atomic `setSeparateAccountsProfile(householdId, arrangement, viewer)` store
method. It must lock and merge only `financialBaseline.profile.separateAccounts` and
`defaultSplit`, preserving the rest of the blob. The present return source is `getHousehold`; the
present writer `completeOnboarding` is a whole-document overwrite and is unsafe for this control.

R2 - Supply active-member `displayName` on route 1. `listMembers` returns identity and role but
not a name, and the split control needs visible names to prevent users assigning a share by an
opaque UUID. This needs a tenancy-scoped users join or a new store projection.

R3 - Add `listMySepacctComponents(householdId, viewer, range)`. It must combine the exact
resolved allocation from `_sepacctAllocationRows`/`owedAgorot` with purchase metadata and only
the viewer's row. The public store exposes neither this list nor the paid/owed components; the UI
cannot safely derive them from ratios or a net figure.

R4 - Add a server-owned onboarding rule for the first exact default ratio. A newly created
household has only one active member, while `defaultSplit` requires real active `userId` values.
The frontend can persist `separateAccounts` in onboarding, but cannot truthfully create a two-person
split until a second adult exists. Either persist a pending ratio explicitly or apply the selected
ratio atomically when the second adult joins; do not invent a placeholder UUID.

## WhatsApp turn sequence

1. Ask: `האם אתם מפרידים כספים?`
2. If no: store `separateAccounts: false`; confirm: `נשמור הוצאות משותפות יחד.`
3. If yes and two active adults exist: ask `איך לחלק הוצאות משותפות? אפשר חצי חצי או יחס אחר.`
4. Accept `50/50`, `60/40`, or two explicit percentages; validate exactly 100% and save basis
   points with the same route 2 rules.
5. If yes and no second adult exists: save only the declaration, say `נקבע את היחס אחרי הצטרפות
   חבר בוגר נוסף.`, and resume at the join event using R4.
6. Confirm with the exact two names and percentages; never infer a ratio from a later expense.
