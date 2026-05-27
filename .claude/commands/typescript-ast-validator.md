---
name: typescript-ast-validator
description: >
  Validates TypeScript code quality and catches hallucinations before they land in production.
  Trigger this skill whenever the user says "check the TypeScript", "validate the code", "run
  typecheck", "does this compile", "find any issues in the frontend/backend", or after any
  significant code-generation session. Also trigger when the user is about to merge, commit, or
  demo TypeScript code. This skill MUST run before self-directed fixes — Claude must not patch
  TypeScript blindly without first running this audit. If the user asks Claude to "fix errors"
  in TypeScript without running checks first, run this skill before touching any file.
---

# TypeScript AST Validator

Catches hallucinations, type holes, and contract mismatches in TypeScript before they reach
production. Run all checks in order. Do not skip checks because "the code looks fine".

---

## Phase 1 — Compiler & Test Gates

Run these first. If they fail, report immediately — do not proceed to AST checks.

### 1.1 Type check
```bash
pnpm typecheck 2>&1 | tail -50
# or: npx tsc --noEmit 2>&1 | tail -50
```
- FAIL if any type errors. List each error file + line.

### 1.2 Relevant tests
```bash
# Run tests for files touched in the current branch diff
CHANGED=$(git diff origin/main...HEAD --name-only | grep -E '\.(ts|tsx)$' | head -20)
pnpm test $CHANGED 2>&1 | tail -60
```
- FAIL if any test fails. Show test name + failure message.

### 1.3 Build
```bash
pnpm build 2>&1 | tail -40
```
- FAIL if build exits non-zero.

---

## Phase 2 — AST / Pattern Searches

Run these even if Phase 1 passes.

### 2.1 Unsafe `any`
```bash
grep -rn ': any\b\|as any\b\|<any>' src/ packages/ --include='*.ts' --include='*.tsx' \
  | grep -v '\.d\.ts\|// @ts-\|node_modules' | head -40
```
- FAIL if found outside of explicitly annotated exceptions.
- Allowed exception pattern: `// allowed-any: <reason>`

### 2.2 Non-determinism (`Math.random`, `Date.now` in business logic)
```bash
grep -rn 'Math\.random\|Date\.now()\|new Date()' src/ packages/ --include='*.ts' --include='*.tsx' \
  | grep -v 'test\|spec\|\.mock\.\|seed\|// deterministic' | head -20
```
- WARN for each occurrence. Flag if in core business logic (not seed/test utilities).

### 2.3 Fake / demo / TODO-production markers
```bash
grep -rn 'fake\|FAKE\|demo\|DEMO\|TODO.*prod\|FIXME.*prod\|hardcoded\|placeholder' \
  src/ packages/ --include='*.ts' --include='*.tsx' | grep -v 'test\|spec' | head -30
```
- FAIL if any marker found in non-test source.

### 2.4 Raw Hebrew in source files (RTL contamination)
```bash
grep -Prn '[\x{0590}-\x{05FF}\x{FB1D}-\x{FDFF}\x{FE70}-\x{FEFF}]' \
  src/ packages/ --include='*.ts' --include='*.tsx' | grep -v '\.test\.\|\.spec\.\|i18n\|locale\|strings' | head -20
```
- FAIL if Hebrew characters appear outside designated i18n/locale files.
- These indicate copy-pasted UI strings hardcoded in logic — a common hallucination artifact.

### 2.5 Unauthorized CORS changes
```bash
git diff origin/main...HEAD -- src/ packages/ | grep -i 'cors\|Access-Control\|origin.*allow' | head -20
```
- FAIL if CORS-related code changes exist and this is not the `cors` stage.
- See `release-gatekeeper` skill for stage definitions.

### 2.6 Route inventory — orphaned API calls
```bash
# Step 1: extract all frontend API calls
grep -rn '\.(get|post|put|patch|delete)\s*(' packages/api-client/src/ src/ \
  --include='*.ts' --include='*.tsx' | grep -oP "(?<=')(\/[^']+)|(?<=\")(\/[^\"]+)" | sort -u > /tmp/frontend_routes.txt

# Step 2: extract all backend routes
grep -rn 'router\.(get|post|put|patch|delete)\s*(' backend/src/ src/routes/ src/api/ \
  --include='*.ts' 2>/dev/null | grep -oP "(?<=')(\/[^']+)|(?<=\")(\/[^\"]+)" | sort -u > /tmp/backend_routes.txt

# Step 3: diff
comm -23 <(sort /tmp/frontend_routes.txt) <(sort /tmp/backend_routes.txt) 2>/dev/null | head -20
```
- FAIL for each frontend route with no matching backend route.
- Adjust paths to match actual repo structure if different.

### 2.7 Imports without backend counterpart
```bash
# Find any imported function names that look like API methods but don't exist in backend
grep -rn "import.*from.*api-client" src/ --include='*.ts' --include='*.tsx' | head -20
```
- Cross-reference each imported method against `packages/api-client/src/` to confirm it exists.
- FAIL for phantom imports.

---

## Phase 3 — Report

```
## TypeScript AST Validation Report

### Phase 1 — Compiler Gates
| Check       | Status | Detail |
|-------------|--------|--------|
| typecheck   | ✅/❌   |        |
| tests       | ✅/❌   |        |
| build       | ✅/❌   |        |

### Phase 2 — AST Patterns
| Check                  | Status | Findings |
|------------------------|--------|----------|
| unsafe any             |        |          |
| Math.random / Date.now |        |          |
| fake/demo markers      |        |          |
| raw Hebrew             |        |          |
| unauthorized CORS      |        |          |
| orphaned API routes    |        |          |
| phantom imports        |        |          |

### Verdict: CLEAN / ISSUES FOUND

Blocking (must fix before merge):
- <list>

Warnings (must review):
- <list>
```

---

## Auto-fix Policy

Claude MUST NOT silently fix issues found here. For each failure:
1. Show the exact file + line.
2. Explain WHY it's a problem.
3. Propose the fix as a diff or suggestion.
4. Wait for explicit user approval before applying.

The only exception is removing `console.log` debug statements — those can be auto-fixed.
