---
name: privacy-role-matrix-auditor
description: >
  Audits role-based access control (RBAC) and privacy boundaries for limited_member,
  adult_member, child wishlists, and household-only endpoints. Use this skill whenever the
  user says "check permissions", "validate role access", "privacy audit", "RBAC review",
  "does limited_member see X", "is this endpoint protected", or when touching auth middleware,
  route guards, or any file in roles/, permissions/, policies/, or middleware/. Also trigger
  when adding new API endpoints or modifying existing ones — every new endpoint must pass this
  audit before merge. Do not skip even if the change looks small.
---

# Privacy Role Matrix Auditor

Protects the privacy boundaries of `limited_member`, `adult_member`, child wishlists, and
household-only data. Run every check below. A single FAIL blocks the PR.

---

## Role Hierarchy Reference

```
owner
  └─ admin
       └─ adult_member       (full household member, read-only on budgets)
            └─ limited_member (restricted: no activity, no spending, no budgets)
child_wishlist               (isolated from adult members)
cross_household              (must always 403)
```

---

## Check Matrix

### 1. `limited_member` — Forbidden endpoints

For each endpoint listed, verify the route handler / middleware denies `limited_member`:

```bash
# Search for role guards on these routes
grep -rn 'limited_member\|limitedMember\|LIMITED_MEMBER' \
  src/ backend/src/ packages/ --include='*.ts' | grep -i 'allow\|permit\|role\|guard\|can\b' | head -40
```

Then verify each forbidden route has an explicit denial:

| Endpoint pattern         | Expected for limited_member |
|--------------------------|-----------------------------|
| `/activity`              | 403                         |
| `/activity/*`            | 403                         |
| `/activity/heatmap`      | 403                         |
| `/spending/*`            | 403                         |
| `/category-budgets`      | 403 or documented exception |
| `/members`               | 403 OR privacy decision documented in CLAUDE.md |

Check each:
```bash
for ROUTE in "/activity" "/spending" "/activity/heatmap" "/category-budgets" "/members"; do
  echo "=== $ROUTE ==="
  grep -rn "\"$ROUTE\"\|'$ROUTE'\|\`$ROUTE" src/ backend/src/ --include='*.ts' | head -5
done
```

- FAIL if any of these routes lacks an explicit role guard.
- FAIL if the guard is present but allows `limited_member`.
- WARN for `/members` only if a privacy decision is documented in CLAUDE.md.

### 2. `adult_member` — Child wishlist isolation

```bash
grep -rn 'wishlist\|child.*wish\|wish.*child' src/ backend/src/ --include='*.ts' | head -30
```

- FAIL if any wishlist endpoint returns results to `adult_member` without explicit child-owner check.
- Expected pattern: wishlist queries must filter by `ownerId === requestingUserId` OR `role === owner/admin`.

### 3. `adult_member` — Category budgets read-only

```bash
grep -rn 'category.budget\|categoryBudget' src/ backend/src/ --include='*.ts' \
  | grep -i 'post\|put\|patch\|delete\|write\|create\|update' | head -20
```

- FAIL if any write endpoint for category-budgets permits `adult_member` (only `owner`/`admin` may write).

### 4. Cross-household 403

```bash
grep -rn 'householdId\|household_id' src/ backend/src/ --include='*.ts' \
  | grep -i 'param\|query\|body\|req\.' | head -30
```

- FAIL if any endpoint accepts a `householdId` from the request without verifying it matches the authenticated user's household.
- Expected pattern: middleware must compare `req.user.householdId === requestedHouseholdId`.

### 5. `phoneE164` format enforcement

```bash
grep -rn 'phone\b' src/ backend/src/ packages/ --include='*.ts' \
  | grep -v 'phoneE164\|E164\|validate.*phone\|phone.*valid\|test\|spec' | head -20
```

- WARN for each `phone` field without E164 validation.
- FAIL if a phone field is stored or compared without E164 normalization.
- Expected pattern: all phone storage must use `phoneE164` typed field or explicit E164 validator.

### 6. New endpoints audit

Find any endpoint added in the current branch diff:
```bash
git diff origin/main...HEAD --unified=0 -- 'src/**/*.ts' 'backend/**/*.ts' \
  | grep '^\+.*router\.\|^\+.*app\.\|^\+.*Route\b' | grep -v '^\+\+\+' | head -20
```

For each new endpoint:
- [ ] Role guard present?
- [ ] Household isolation enforced?
- [ ] Limited_member excluded where appropriate?
- [ ] Listed in CLAUDE.md route inventory?

---

## Report Format

```
## Privacy Role Matrix Audit Report

### limited_member Forbidden Routes
| Route                  | Guard Present | Verdict |
|------------------------|---------------|---------|
| /activity              | ✅/❌          | ✅/❌   |
| /activity/heatmap      |               |         |
| /spending/*            |               |         |
| /category-budgets      |               |         |
| /members               |               |         |

### adult_member Isolation
| Check                        | Status |
|------------------------------|--------|
| Child wishlist isolated      |        |
| Category budgets read-only   |        |

### Cross-household 403        | ✅/❌  |
### phoneE164 enforcement       | ✅/❌  |
### New endpoints audited       | N found, N clean |

### Verdict: APPROVED / BLOCKED

Blocking issues:
- <list each FAIL>

Required documentation in CLAUDE.md:
- <list any WARN that requires a documented exception>
```

---

## Exception Protocol

If a privacy decision deviates from the defaults above:
1. The decision MUST be documented in `CLAUDE.md` under a `## Privacy Exceptions` section.
2. The PR description must reference the CLAUDE.md entry.
3. This audit marks it WARN (not FAIL) only if the CLAUDE.md entry exists and is dated.
