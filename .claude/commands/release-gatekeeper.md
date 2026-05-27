---
name: release-gatekeeper
description: >
  Gate-keeps stage completion and enforces Definition of Done (DoD) before any stage is closed or
  merged. Use this skill whenever the user says "I finished stage X", "ready to merge", "closing
  the sprint", "done with hardening", "let's move to the next phase", or asks to verify a release
  is ready. Also trigger when the user asks to validate branch state, check if CLAUDE.md is
  updated, or confirm commits are pushed. This skill MUST run before any stage sign-off — do not
  skip it even if the user sounds confident.
---

# Release Gatekeeper

Enforces Definition of Done (DoD) before any stage is approved. Run every check below in order
and block sign-off on ANY failure. Do not let the user "push through" a failed gate.

---

## Stage Definitions

| Stage slug        | What it covers                                      |
|-------------------|-----------------------------------------------------|
| `cors`            | CORS configuration changes are allowed ONLY here    |
| `nginx`           | nginx config changes are allowed ONLY here          |
| `hardening`       | Security / perf hardening — NO new product features |
| `feature-*`       | Feature work — no nginx/CORS drift                  |
| `release`         | Final integration — all gates must pass             |

---

## Gate Checklist

Run each check with `bash_tool`. Report PASS / FAIL / WARN per item.

### 1. Branch name
```bash
git rev-parse --abbrev-ref HEAD
```
- Expected pattern must match the declared stage (e.g. `stage/cors`, `stage/hardening`).
- FAIL if branch name doesn't match the stage being signed off.

### 2. Working tree clean
```bash
git status --short
```
- FAIL if any modified, untracked, or staged files exist.
- Exception: explicitly allowlisted files documented in CLAUDE.md.

### 3. CORS changes outside CORS stage
```bash
git diff origin/main...HEAD -- '*.conf' '*.ts' '*.js' | grep -i 'cors\|Access-Control' | head -40
```
- FAIL if CORS-related changes appear and current stage is NOT `cors`.
- WARN if on `cors` stage but changes extend beyond expected files.

### 4. nginx changes outside nginx stage
```bash
git diff origin/main...HEAD -- '*.conf' '*nginx*' '*proxy*' | head -40
```
- FAIL if nginx config changes appear outside `nginx` stage.

### 5. Product features during hardening
If current stage is `hardening`:
```bash
git diff origin/main...HEAD -- 'src/' 'app/' 'packages/' | grep -E '^\+.*\b(function|const|class|export)\b' | grep -v 'test\|spec\|\.d\.ts' | head -40
```
- FAIL if new exported symbols / components appear in product source.
- Security fixes and refactors are OK — ask the user to confirm intent for each flagged item.

### 6. CLAUDE.md updated
```bash
git diff origin/main...HEAD -- CLAUDE.md | head -60
```
- FAIL if CLAUDE.md has zero diff (it must be updated at each stage close).
- WARN if diff is fewer than 5 lines (may be insufficient).

### 7. Commit hashes present
```bash
git log --oneline -n 10
```
- FAIL if the log is empty or HEAD is a detached state.
- Record the tip SHA for push verification below.

### 8. Push verification
```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote origin "$BRANCH" | awk '{print $1}')
echo "local=$LOCAL_SHA remote=$REMOTE_SHA"
```
- FAIL if `remote` is empty (branch not pushed).
- FAIL if `local != remote` (local commits not yet pushed).

### 9. No unrelated branch modifications
```bash
git branch -r --merged HEAD | grep -v "origin/$BRANCH\|origin/main\|origin/HEAD"
```
- WARN if unexpected branches appear in the merge ancestry.

### 10. Stash check
```bash
git stash list
```
- WARN if stash contains entries (developer may have forgotten work).

---

## Reporting Format

After running all checks, produce a table:

```
## Release Gate Report — stage: <stage> — branch: <branch>

| # | Check                        | Status | Detail                    |
|---|------------------------------|--------|---------------------------|
| 1 | Branch name                  | ✅ PASS |                           |
| 2 | Working tree clean           | ❌ FAIL | 3 modified files          |
...

### Verdict: BLOCKED / APPROVED

Blocking issues:
- <list each FAIL>

Warnings (non-blocking):
- <list each WARN>
```

**NEVER approve a stage with any FAIL.** WARNs must be acknowledged by the user before approval.

---

## User Override Protocol

If the user says "just approve it anyway" or "ignore that check":
1. Restate which specific check failed and why it matters.
2. Offer a path to fix it (e.g. `git push`, update CLAUDE.md).
3. Do NOT approve. Gate stands until the check passes or the user explicitly documents a justified exception in CLAUDE.md.

---

## Quick Reference — Common Fixes

| Failure              | Fix command                                         |
|----------------------|-----------------------------------------------------|
| Not pushed           | `git push origin <branch>`                          |
| Dirty tree           | `git add -A && git commit -m "chore: cleanup"` or `git stash` |
| CLAUDE.md not updated | Edit CLAUDE.md, commit, push                       |
| CORS in wrong stage  | Cherry-pick to cors branch or revert               |
