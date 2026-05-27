---
name: playwright-smoke-runner
description: >
  Runs Playwright smoke tests across all critical viewports and user roles. Use this skill
  whenever the user says "run smoke tests", "run e2e", "test the UI", "does it work on mobile",
  "check all roles", "run playwright", or before any UI-touching merge or demo. Also trigger
  when the user says "it looks fine" about layout — CSS visual claims must be verified by
  actual Playwright runs, never by simulation or description. This skill MUST replace any
  manual or simulated UI verification. Do not accept "I checked it visually" as a substitute.
---

# Playwright Smoke Runner

Runs real browser smoke tests across two viewports and five role/data combinations.
Never accept CSS simulation as a substitute. Every run must use actual browser rendering.

---

## Prerequisites

```bash
# Verify Playwright is available
npx playwright --version 2>&1

# Verify test fixtures/auth helpers exist
ls e2e/ tests/e2e/ playwright/ 2>/dev/null | head -20
```

If Playwright is not installed:
```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

---

## Required Test Matrix

Every smoke run MUST cover ALL of the following combinations:

### Viewports
| ID       | Width | Height | Purpose         |
|----------|-------|--------|-----------------|
| mobile   | 375   | 812    | iPhone viewport |
| desktop  | 1280  | 800    | Standard laptop |

### Roles × Data states
| Role            | Data state      |
|-----------------|-----------------|
| owner / admin   | household data  |
| adult_member    | household data  |
| limited_member  | household data  |
| owner / admin   | empty household |
| any role        | empty household |

Total minimum runs: 2 viewports × 5 combos = **10 test executions**.

---

## Smoke Test Script

Create or reference `e2e/smoke.spec.ts`. Minimum content:

```typescript
import { test, expect, Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
];

const ROLES = [
  { name: 'owner', fixture: 'owner-with-data' },
  { name: 'adult_member', fixture: 'adult-with-data' },
  { name: 'limited_member', fixture: 'limited-with-data' },
  { name: 'owner-empty', fixture: 'owner-empty-household' },
];

for (const vp of VIEWPORTS) {
  for (const role of ROLES) {
    test(`smoke: ${role.name} @ ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: `e2e/fixtures/${role.fixture}.json`,
        recordVideo: { dir: `test-results/smoke-${role.name}-${vp.name}/` },
      });
      const page = await context.newPage();

      // Capture all network requests
      const failedRequests: string[] = [];
      page.on('requestfailed', req => failedRequests.push(req.url()));
      page.on('response', resp => {
        if (resp.status() >= 500) failedRequests.push(`${resp.status()} ${resp.url()}`);
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Horizontal overflow check — CRITICAL
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `Horizontal overflow at ${vp.name}`).toBe(false);

      // Screenshot
      await page.screenshot({
        path: `test-results/screenshots/${role.name}-${vp.name}.png`,
        fullPage: true,
      });

      // No 5xx errors
      expect(failedRequests, `Failed requests for ${role.name}`).toEqual([]);

      await context.close();
    });
  }
}
```

---

## Running the Tests

```bash
# Run all smoke tests
npx playwright test e2e/smoke.spec.ts \
  --reporter=list \
  --output=test-results/smoke \
  2>&1 | tee /tmp/smoke-run.log

# Show failures clearly
grep -E 'FAILED|Error:|×' /tmp/smoke-run.log | head -30
```

---

## Overflow Check (Hard Requirement)

The following check MUST pass for every viewport:

```bash
# Verify no test skipped the overflow assertion
grep -c 'scrollWidth' e2e/smoke.spec.ts
```

- FAIL if `document.scrollWidth > window.innerWidth` is true for any viewport/role combo.
- This check cannot be waived. Horizontal scroll = broken layout = FAIL.

---

## Network Log Review

After each run, review logged requests for:
```bash
# Extract 4xx/5xx responses from Playwright trace
grep -E '4[0-9]{2}|5[0-9]{2}' /tmp/smoke-run.log | grep -v '404.*favicon' | head -20
```

- FAIL for any 5xx response.
- WARN for unexpected 4xx (403 on `/members` for `limited_member` is expected — document it).

---

## Screenshot Paths

All screenshots saved to:
```
test-results/screenshots/
├── owner-mobile.png
├── owner-desktop.png
├── adult_member-mobile.png
├── adult_member-desktop.png
├── limited_member-mobile.png
├── limited_member-desktop.png
├── owner-empty-mobile.png
└── owner-empty-desktop.png
```

After the run, list the files:
```bash
ls -lh test-results/screenshots/*.png 2>/dev/null
```

- FAIL if any expected screenshot file is missing.

---

## Report Format

```
## Playwright Smoke Run Report

| Role            | Viewport | Overflow | 5xx Errors | Screenshot | Status |
|-----------------|----------|----------|------------|------------|--------|
| owner           | mobile   | ❌ none   | ❌ none     | ✅          | ✅ PASS |
| owner           | desktop  |          |            |            |        |
| adult_member    | mobile   |          |            |            |        |
| adult_member    | desktop  |          |            |            |        |
| limited_member  | mobile   |          |            |            |        |
| limited_member  | desktop  |          |            |            |        |
| owner-empty     | mobile   |          |            |            |        |
| owner-empty     | desktop  |          |            |            |        |

### Verdict: ALL GREEN / FAILURES FOUND

Blocking failures:
- <list>
```

---

## No Simulation Policy

If Playwright cannot run (CI not available, browser not installed):
1. State clearly: "Cannot run smoke tests — Playwright not available."
2. Do NOT describe what the UI "should" look like.
3. Do NOT substitute with CSS review or manual inspection claims.
4. Block the merge until tests can run.
