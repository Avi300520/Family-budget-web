---
name: shared-contract-sync-auditor
description: >
  Detects drift between Backend, Frontend, shared-types, api-client, and DB schema. Use this
  skill whenever the user says "sync the contracts", "check for drift", "did the types change",
  "are the repos in sync", "shared-types audit", "api-client mismatch", or when adding or
  modifying any field in shared-types, api-client, DB migrations, or backend routes. Also
  trigger before any release or merge that touches packages/shared-types or packages/api-client.
  Contract drift silently corrupts data — run this skill even if the change "looks trivial".
---

# Shared Contract Sync Auditor

Prevents silent drift between Backend, Frontend, `shared-types`, `api-client`, and the DB.
Each check below represents a contract boundary. A FAIL at any boundary blocks the merge.

---

## Repo Layout Assumptions

Adjust paths below if your monorepo differs. Document actual paths in CLAUDE.md.

```
<root>/
├── packages/
│   ├── shared-types/src/     ← canonical types (must be identical in both repos)
│   └── api-client/src/       ← generated client (must be identical in both repos)
├── backend/src/
│   ├── routes/               ← Express/Fastify route definitions
│   └── migrations/           ← DB migration files
└── frontend/src/             ← consumer of api-client
```

If operating across two separate repos (e.g. `monorepo-backend` + `monorepo-frontend`),
both must be checked out locally. If only one is available, mark cross-repo checks as SKIP
and flag for manual verification.

---

## Check 1 — shared-types identical across repos

```bash
# If both repos are checked out side-by-side:
diff -rq \
  ./backend/packages/shared-types/src \
  ./frontend/packages/shared-types/src \
  --exclude='*.map' --exclude='*.js' 2>&1 | head -30

# Single-repo monorepo — just confirm one copy exists and is imported consistently:
find . -path '*/shared-types/src' -not -path '*/node_modules/*' | head -5
```

- FAIL if diff shows any file difference.
- FAIL if multiple copies exist with different content.

## Check 2 — api-client identical across repos

```bash
diff -rq \
  ./backend/packages/api-client/src \
  ./frontend/packages/api-client/src \
  --exclude='*.map' --exclude='*.js' 2>&1 | head -30
```

- FAIL if any divergence.

## Check 3 — api-client method ↔ backend route coverage

```bash
# Extract api-client method names
grep -rn 'async \|: Promise' packages/api-client/src/ --include='*.ts' \
  | grep -oP '(?<=async )\w+|(?<=function )\w+' | sort -u > /tmp/client_methods.txt

# Extract backend route handlers
grep -rn 'router\.\|app\.' backend/src/routes/ --include='*.ts' \
  | grep -oP "(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)" \
  | sort -u > /tmp/backend_routes_raw.txt

echo "=== Client methods without matching routes ==="
# Manual cross-reference needed — show both lists for review
cat /tmp/client_methods.txt | head -30
echo "---"
cat /tmp/backend_routes_raw.txt | head -30
```

- FAIL if an api-client method has no corresponding backend route.
- FAIL if a backend route handler is missing from the api-client (silent missing feature).

## Check 4 — New fields exist in shared-types

```bash
# Find new fields added in the current diff
git diff origin/main...HEAD -- 'packages/shared-types/src/' | grep '^\+' | grep -v '^\+\+\+' | head -30

# Find corresponding usage in backend and frontend
git diff origin/main...HEAD -- 'backend/src/' 'frontend/src/' 'src/' \
  | grep '^\+' | grep -v '^\+\+\+' | head -30
```

- FAIL if a field is used in backend or frontend but not defined in `shared-types`.
- FAIL if a field is defined in `shared-types` but never referenced (dead field — potential drift).

## Check 5 — Migrations match store/model code

```bash
# List recent migrations
ls -lt backend/src/migrations/ 2>/dev/null || ls -lt db/migrations/ 2>/dev/null | head -10

# Find the newest migration
LATEST=$(ls -t backend/src/migrations/*.ts 2>/dev/null || ls -t db/migrations/*.sql 2>/dev/null | head -1)
echo "Latest migration: $LATEST"
cat "$LATEST" 2>/dev/null | head -60
```

For each new column or table in migrations:
```bash
# Check if model/entity reflects the migration
grep -rn 'Column\|@Column\|column\b\|field\b' backend/src/models/ backend/src/entities/ \
  --include='*.ts' 2>/dev/null | head -30
```

- FAIL if migration adds a column that doesn't appear in the corresponding model/entity.
- FAIL if migration drops a column that is still referenced in model code.

## Check 6 — Frontend not expecting fields backend doesn't return

```bash
# Find fields the frontend accesses from API responses
grep -rn '\bresponse\.\|\.data\.\|result\.' frontend/src/ src/ \
  --include='*.ts' --include='*.tsx' \
  | grep -oP '(?<=\.)\w+(?=\b)' | sort | uniq -c | sort -rn | head -30
```

Cross-reference the top-used field names against what backend route handlers actually return.

- FAIL if frontend accesses a field (`response.data.fieldX`) that no backend route returns.
- WARN if field access is conditional/optional and may be intentional.

---

## Report Format

```
## Shared Contract Sync Audit Report

| Check                              | Status | Detail                        |
|------------------------------------|--------|-------------------------------|
| 1. shared-types identical          | ✅/❌   |                               |
| 2. api-client identical            | ✅/❌   |                               |
| 3. api-client ↔ backend routes     | ✅/❌   | N orphaned methods            |
| 4. New fields in shared-types      | ✅/❌   |                               |
| 5. Migrations ↔ model code         | ✅/❌   |                               |
| 6. Frontend fields ↔ backend resp  | ✅/❌   |                               |

### Verdict: IN SYNC / DRIFT DETECTED

Drift items (must resolve before merge):
- <list each FAIL with file paths>

Warnings:
- <list each WARN>

Skipped (manual verification required):
- <list each SKIP with reason>
```

---

## Fix Guidance

| Drift type              | Fix                                                            |
|-------------------------|----------------------------------------------------------------|
| shared-types mismatch   | Copy canonical version, bump version field, run `pnpm build`  |
| Missing api-client method | Regenerate client or add method manually, add backend route  |
| Migration/model gap     | Add column to model or revert migration                        |
| Frontend phantom field  | Remove access or add field to backend response DTO             |
