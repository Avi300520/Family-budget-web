#!/usr/bin/env node
/**
 * scripts/a11y-axe.mjs — automated axe-core accessibility check of the PUBLIC routes.
 *
 * Added by BATCH-GH to close §8 step 8 of
 *   "Shopping assistant/docs/audit/2026-07-06/ACCESSIBILITY_AUDIT.md"
 * ("no automated a11y tooling is installed in the repo").
 *
 * =====================================================================================
 *  !!  READ THIS BEFORE TRUSTING A GREEN RUN  !!
 * =====================================================================================
 * This script has TWO engines and they are NOT equivalent:
 *
 *   [browser]  @axe-core/playwright + playwright-chromium (PREFERRED, full fidelity).
 *              Real layout, real computed styles, real colour-contrast evaluation,
 *              client-side React islands hydrated. Used automatically when both
 *              packages resolve.
 *
 *   [jsdom]    axe-core + jsdom against the SERVER-RENDERED HTML (FALLBACK, WEAKER).
 *              jsdom has NO layout engine and NO CSS cascade for computed colour, so:
 *                * colour-contrast (WCAG 1.4.3) is NOT evaluated -> reported "incomplete",
 *                  never "pass". Appendix A of the audit is still the authority there.
 *                * target-size / reflow / focus-visibility cannot be evaluated at all.
 *                * client-only UI (accessibility menu, FAQ accordion, wizard step bodies,
 *                  /l shopping list rows, /join phases) is NOT hydrated, so only the
 *                  initial SSR/prerendered markup is scanned.
 *              A clean [jsdom] run therefore means "no violations in the static markup",
 *              NOT "the page is WCAG 2.0 AA conformant". Do not quote it as conformance.
 *
 * Neither engine replaces the manual work the audit requires: keyboard pass, 200% zoom /
 * 320px reflow, and a real VoiceOver + NVDA pass.
 * =====================================================================================
 *
 * DEPENDENCY NOTE
 * ---------------
 * `axe-core` and `jsdom` are committed root devDependencies (pure JS, no postinstall,
 * not bundled into the app -> the repo's runtime "no new deps" gate is unaffected).
 *
 * `@axe-core/playwright` + `playwright-chromium` are deliberately NOT in package.json:
 * Vercel's production install is `pnpm install --frozen-lockfile` at the workspace root,
 * so a committed playwright dep would download a ~150MB Chromium on every production
 * build. (The repo already keeps @playwright/test out of the lockfile for the same
 * reason - see the e2e smoke harness and apps/web/tsconfig.json's "e2e" exclude.)
 * To run the strong engine, install them on demand (CI step or locally):
 *
 *   pnpm add -Dw @axe-core/playwright playwright-chromium
 *   npx playwright install chromium          # (CI: --with-deps chromium)
 *   pnpm a11y
 *   git checkout -- package.json pnpm-lock.yaml   # keep them out of the committed tree
 *
 * USAGE
 * -----
 *   pnpm a11y                              # build apps/web, start it, scan, report
 *   A11Y_SKIP_BUILD=1 pnpm a11y            # reuse an existing apps/web/.next build
 *   A11Y_BASE_URL=http://localhost:3000 pnpm a11y   # scan an already-running server
 *   A11Y_ENGINE=jsdom pnpm a11y            # force the weak engine even if playwright exists
 *
 * BACKEND
 * -------
 * By default NEXT_PUBLIC_API_URL points at a dead port so every route renders WITHOUT a
 * backend. That is intentional: the resulting error / empty / "invalid link" states are
 * themselves public UI in scope for the audit. It also means the authenticated-success
 * branches of /auth/consume, /join and /onboarding are NOT covered here - see the
 * per-route "coverage" column in the output.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");
const IS_WIN = process.platform === "win32";

/** Public routes under the accessibility statement (audit §1.1). */
const ROUTES = [
  { path: "/", name: "/ (landing)", coverage: "full" },
  { path: "/login", name: "/login", coverage: "full" },
  {
    path: "/auth/consume?token=a11y-scan-invalid-token",
    name: "/auth/consume",
    coverage: "error-state only (no backend; success branch redirects and cannot be scanned here)",
  },
  {
    path: "/join?token=a11y-scan-invalid-token",
    name: "/join",
    coverage: "error-state only (invite lookup fails without a backend; auth/preview/done phases not covered)",
  },
  {
    path: "/onboarding",
    name: "/onboarding",
    coverage: "loading/entry shell only (wizard needs an authenticated session; step bodies not covered)",
  },
  {
    path: "/l/a11y-scan-invalid-token",
    name: "/l/[token]",
    coverage: "error-state only (needs a real share token + backend for the list/done/locked states)",
  },
  { path: "/privacy", name: "/privacy", coverage: "full" },
  { path: "/terms", name: "/terms", coverage: "full" },
];

const AXE_OPTIONS = { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } };

function log(...args) {
  console.log(...args);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: IS_WIN, ...opts });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForServer(baseUrl, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

/** Try to load the high-fidelity engine. Returns null when unavailable. */
async function loadBrowserEngine() {
  if (process.env.A11Y_ENGINE === "jsdom") return null;
  try {
    const [{ default: AxeBuilder }, { chromium }] = await Promise.all([
      import("@axe-core/playwright"),
      import("playwright-chromium"),
    ]);
    return { AxeBuilder, chromium };
  } catch {
    return null;
  }
}

async function scanWithBrowser({ AxeBuilder, chromium }, baseUrl) {
  const browser = await chromium.launch();
  // @axe-core/playwright requires a Page created from an explicit BrowserContext.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  try {
    for (const route of ROUTES) {
      const page = await context.newPage();
      try {
        await page.goto(baseUrl + route.path, { waitUntil: "networkidle", timeout: 45_000 });
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        results.push({ route, violations: r.violations, incomplete: r.incomplete, url: page.url() });
      } catch (err) {
        results.push({ route, error: String(err && err.message ? err.message : err) });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function scanWithJsdom(baseUrl) {
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const axeSource = fs.readFileSync(
    path.join(REPO_ROOT, "node_modules", "axe-core", "axe.min.js"),
    "utf8",
  );
  const results = [];
  for (const route of ROUTES) {
    const url = baseUrl + route.path;
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();
      const virtualConsole = new VirtualConsole(); // swallow page console/jsdom CSS noise
      const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
      const { window } = dom;
      window.eval(axeSource);
      const r = await window.axe.run(window.document, AXE_OPTIONS);
      results.push({ route, violations: r.violations, incomplete: r.incomplete, url, status: res.status });
      window.close();
    } catch (err) {
      results.push({ route, error: String(err && err.message ? err.message : err) });
    }
  }
  return results;
}

function report(engine, results) {
  const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
  log("");
  log("=".repeat(96));
  log(`  axe-core WCAG 2.0 A/AA scan - engine: [${engine}]`);
  if (engine === "jsdom") {
    log("  WARNING: jsdom fallback. No layout, no computed colour-contrast, no client-side");
    log("  hydration. A clean result here is NOT a WCAG 2.0 AA conformance claim.");
  }
  log("=".repeat(96));
  log(`  ${pad("ROUTE", 22)}${pad("VIOLATIONS", 12)}${pad("INCOMPLETE", 12)}COVERAGE`);
  log("-".repeat(96));
  let total = 0;
  let errored = 0;
  for (const r of results) {
    if (r.error) {
      errored += 1;
      log(`  ${pad(r.route.name, 22)}${pad("ERROR", 12)}${pad("-", 12)}${r.error}`);
      continue;
    }
    total += r.violations.length;
    log(
      `  ${pad(r.route.name, 22)}${pad(r.violations.length, 12)}${pad(r.incomplete.length, 12)}${r.route.coverage}`,
    );
  }
  log("-".repeat(96));

  for (const r of results) {
    if (r.error || r.violations.length === 0) continue;
    log("");
    log(`### ${r.route.name}  (${r.url})`);
    for (const v of r.violations) {
      log(`  [${v.impact ?? "n/a"}] ${v.id} - ${v.help}`);
      log(`      tags: ${v.tags.join(", ")}`);
      log(`      ${v.helpUrl}`);
      const maxNodes = Number(process.env.A11Y_MAX_NODES || 5);
      for (const node of v.nodes.slice(0, maxNodes)) {
        log(`      -> ${node.target.join(" ")}`);
        const snippet = (node.html || "").replace(/\s+/g, " ").slice(0, 160);
        if (snippet) log(`         ${snippet}`);
        for (const c of node.any || []) {
          if (c.message) log(`         ${c.message.replace(/\s+/g, " ")}`);
        }
      }
      if (v.nodes.length > maxNodes) {
        log(`      ... and ${v.nodes.length - maxNodes} more node(s) (A11Y_MAX_NODES=999 to see all)`);
      }
    }
  }

  log("");
  log(`TOTAL VIOLATIONS: ${total}${errored ? `  (routes that failed to load: ${errored})` : ""}`);
  if (engine === "jsdom") {
    log('NOTE: "INCOMPLETE" on the jsdom engine is dominated by colour-contrast, which jsdom');
    log("      cannot compute. Use the [browser] engine or Appendix A of the audit for 1.4.3.");
  }
  log("");
  return total > 0 || errored > 0 ? 1 : 0;
}

async function main() {
  let baseUrl = process.env.A11Y_BASE_URL;
  let server;

  if (!baseUrl) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:9";
    if (process.env.A11Y_SKIP_BUILD !== "1") {
      log(`> building apps/web (NEXT_PUBLIC_API_URL=${apiUrl})`);
      await run("pnpm", ["--filter", "@shopping-assistant/web", "build"], {
        cwd: REPO_ROOT,
        env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
      });
    }
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    log(`> starting next on ${baseUrl}`);
    server = spawn("npx", ["next", "start", "-p", String(port)], {
      cwd: WEB_DIR,
      stdio: "ignore",
      shell: IS_WIN,
      env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
    });
    if (!(await waitForServer(baseUrl))) {
      server.kill();
      throw new Error(`next start did not become reachable at ${baseUrl}`);
    }
  } else {
    log(`> scanning already-running server at ${baseUrl}`);
  }

  try {
    const browserEngine = await loadBrowserEngine();
    const results = browserEngine
      ? await scanWithBrowser(browserEngine, baseUrl)
      : await scanWithJsdom(baseUrl);
    process.exitCode = report(browserEngine ? "browser" : "jsdom", results);
  } finally {
    if (server) server.kill();
  }
}

main().catch((err) => {
  console.error("a11y-axe failed:", err);
  process.exit(2);
});
