---
name: git-github-sanity
description: >
  Verifies real Git state and prevents false reporting of commits, pushes, or branch status.
  Use this skill whenever the user asks "did you push?", "are the commits on GitHub?", "what's
  the current branch state?", "is the remote up to date?", "show me the last commits", or
  whenever Claude is about to report that a push or commit succeeded. This skill MUST run
  before Claude claims any git operation completed. Never report a commit as pushed without
  running push verification. Never report a clean working tree without running git status.
---

# Git / GitHub Sanity Checker

Prevents false reporting of git state. Every claim about commits, pushes, or branch status
must be backed by the output of these checks — not by Claude's memory of prior tool calls.

**Rule: Claude must never say "I pushed" or "it's on GitHub" without running Check 5.**

---

## Check 1 — Working tree status

```bash
git status --short
```

Expected output for a clean tree: _(empty)_

- FAIL if any modified (`M`), staged (`A`), or untracked (`?`) files exist.
- REPORT: list every flagged file with its status code.

Interpretation guide:
| Code | Meaning                    |
|------|----------------------------|
| `M`  | Modified (not staged)       |
| `A`  | Staged (not committed)      |
| `??` | Untracked                   |
| `D`  | Deleted                     |
| `R`  | Renamed                     |

---

## Check 2 — Recent commits

```bash
git log --oneline -n 5
```

- FAIL if output is empty (no commits, likely detached HEAD or new repo).
- REPORT: show all 5 lines verbatim. This is the source of truth for what exists locally.
- Record the tip SHA (first line) for use in Check 5.

---

## Check 3 — Current branch

```bash
git rev-parse --abbrev-ref HEAD
```

- REPORT: state the current branch name.
- WARN if branch is `HEAD` (detached HEAD state).
- WARN if branch name doesn't match expected pattern for the current stage (see `release-gatekeeper`).

---

## Check 4 — No unrelated branch modifications

```bash
# Show all local branches with their last commit
git branch -v
```

```bash
# Show branches that diverged from main unexpectedly
git branch --no-merged origin/main 2>/dev/null | grep -v "$(git rev-parse --abbrev-ref HEAD)" | head -10
```

- WARN if any branch other than the current one has recent commits not merged to main.
- FAIL if a branch that should be clean (e.g. `main`, `staging`) has local-only commits.

---

## Check 5 — Remote push verification (CRITICAL)

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote origin "$BRANCH" 2>/dev/null | awk '{print $1}')

echo "Branch:     $BRANCH"
echo "Local SHA:  $LOCAL_SHA"
echo "Remote SHA: $REMOTE_SHA"

if [ -z "$REMOTE_SHA" ]; then
  echo "VERDICT: FAIL — branch not found on remote"
elif [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "VERDICT: PASS — remote matches local"
else
  echo "VERDICT: FAIL — remote is behind local"
  echo "Unpushed commits:"
  git log --oneline "$REMOTE_SHA..$LOCAL_SHA" 2>/dev/null | head -10
fi
```

- FAIL if `REMOTE_SHA` is empty — branch does not exist on remote.
- FAIL if `LOCAL_SHA != REMOTE_SHA` — commits exist locally that are not on GitHub.
- PASS only if both SHAs match exactly.

**This check is the ONLY valid basis for claiming "it's pushed".**

---

## Check 6 — CORS stash status

```bash
git stash list | grep -i 'cors\|CORS' | head -5
```

- WARN if any CORS-related stash entry exists (may indicate stashed CORS work that was never
  applied or was forgotten).
- REPORT: show stash ref + message for any match.

Also show all stash entries as a general hygiene check:
```bash
git stash list | head -10
```

---

## Check 7 — No untracked artifacts staged

```bash
# Show staged files (index vs HEAD)
git diff --cached --name-only | head -20

# Check for artifacts that should not be committed
git diff --cached --name-only | grep -E '\.(log|tmp|DS_Store|lock~|orig)$|node_modules|dist/|build/' | head -10
```

- FAIL if build artifacts (`dist/`, `build/`, `.next/`), log files, or `node_modules` are staged.
- WARN for any `.lock` file other than the project's canonical lockfile (e.g. `pnpm-lock.yaml`).

---

## Full Run Command

Run all checks in sequence:
```bash
echo "=== CHECK 1: Working tree ===" && git status --short && \
echo "" && echo "=== CHECK 2: Recent commits ===" && git log --oneline -n 5 && \
echo "" && echo "=== CHECK 3: Current branch ===" && git rev-parse --abbrev-ref HEAD && \
echo "" && echo "=== CHECK 4: Other branches ===" && git branch -v && \
echo "" && echo "=== CHECK 6: Stash ===" && git stash list | head -10 && \
echo "" && echo "=== CHECK 7: Staged artifacts ===" && git diff --cached --name-only | head -20
```

Then run Check 5 separately (it uses variables).

---

## Report Format

```
## Git Sanity Report — <timestamp>

| Check                          | Status | Detail                        |
|--------------------------------|--------|-------------------------------|
| 1. Working tree clean          | ✅/❌   |                               |
| 2. Recent commits present      | ✅/❌   | tip: <sha> <message>          |
| 3. Branch                      | ✅/⚠️   | branch: <name>                |
| 4. No unrelated branch drift   | ✅/⚠️   |                               |
| 5. Push verified (remote=local)| ✅/❌   | local: <sha> remote: <sha>    |
| 6. CORS stash check            | ✅/⚠️   |                               |
| 7. No artifacts staged         | ✅/❌   |                               |

### Verdict: CLEAN / ISSUES FOUND

Blocking (must resolve before claiming push success):
- <list each FAIL>

Warnings:
- <list each WARN>
```

---

## Reporting Policy

After running this skill, Claude MUST:
- Use the actual SHA from Check 5 when referring to any commit.
- Never say "pushed" unless Check 5 shows `PASS`.
- Never say "working tree is clean" unless Check 1 shows empty output.
- If any check failed, lead with the failure before any other statement.
