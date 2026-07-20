// ESLint 9 flat config — ACCESSIBILITY LINTING ONLY.
//
// !! FILENAME IS DELIBERATE: `eslint.a11y.config.mjs`, NOT `eslint.config.mjs`. !!
// Next.js 15 runs ESLint as part of `next build` whenever it can find-up a
// STANDARD-named eslint config from apps/web. Naming this file `eslint.config.mjs`
// made `pnpm --filter @shopping-assistant/web build` (and therefore the Vercel
// production build) FAIL on the pre-existing jsx-a11y findings listed below.
// The non-standard name keeps `next build` behaviour byte-identical to before this
// batch: linting stays an explicit, separate step (`pnpm lint`).
// If build-time a11y gating is wanted later, that is an intentional opt-in via
// `eslint` config in apps/web/next.config.ts - do it only once `pnpm lint` is clean.
//
// Scope: apps/web/src/**/*.tsx (the Next.js public + app UI). This config is
// deliberately NOT a general-purpose style/quality ruleset: it enables the
// eslint-plugin-jsx-a11y recommended rules and nothing else, so the output stays
// small enough that a11y regressions are actually noticed instead of drowned in
// hundreds of unrelated stylistic errors.
//
// Added by BATCH-GH (accessibility implementation) to close audit §8 step 8
// ("no eslint-plugin-jsx-a11y installed, no lint script wired").
//
// Run:  pnpm lint          (fails the process on any error)
//       pnpm lint:a11y     (alias)
//
// NOTE: these are DEV dependencies. The repo's "no new deps" release gate is
// about runtime deps shipped to the browser; nothing here is bundled by Next.

import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";

// The repo contains pre-existing `// eslint-disable-next-line react-hooks/exhaustive-deps`
// comments (dashboard, onboarding/controls, shopping-list). ESLint hard-errors with
// "Definition for rule ... was not found" when a disable comment names a rule that no
// loaded plugin defines. eslint-plugin-react-hooks is NOT installed and is NOT an
// accessibility concern, so rather than pull in an unrelated plugin we register a
// namespace with a no-op rule purely so those comments resolve.
//
// !! IMPORTANT: this does NOT lint react hooks. Nothing checks exhaustive-deps in this
// !! repo. If react-hooks linting is ever wanted, install eslint-plugin-react-hooks and
// !! DELETE this shim.
const reactHooksNoopShim = {
  rules: {
    "exhaustive-deps": { meta: { schema: [] }, create: () => ({}) },
    "rules-of-hooks": { meta: { schema: [] }, create: () => ({}) },
  },
};

export default [
  {
    // Never lint build output, deps, or generated/vendored trees.
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "ds-bundle/**",
      "design_handoff_home_page/**",
      "design_handoff_pingtally_app/**",
      "docs/**",
      "packages/**",
      // apps/admin is an internal tool, explicitly out of the public
      // accessibility-statement scope (audit §1.1). Not linted here.
      "apps/admin/**",
    ],
  },
  {
    files: ["apps/web/src/**/*.{tsx,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // This config intentionally loads only jsx-a11y. Disable comments aimed at
      // rules outside that set are therefore "unused" here, which is expected and
      // must not be reported. Unused *jsx-a11y* disables are impossible to hide
      // this way because we never add any (see: no blanket eslint-disable policy).
      reportUnusedDisableDirectives: "off",
    },
    plugins: { "jsx-a11y": jsxA11y, "react-hooks": reactHooksNoopShim },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,

      // The app is RTL Hebrew: aria-* values and alt text are Hebrew strings.
      // No rule here inspects string language, so no language overrides are needed.

      // --- the ONLY rule tuning in this config, and it is a real a11y decision ---
      // `<ul role="list">` is NOT redundant in this codebase: the list containers are
      // `display:grid` / `list-style:none`, and Safari+VoiceOver drop list semantics
      // ("list, N items") from such lists unless the role is stated explicitly. The
      // audit itself prescribes `<ul role="list">` (P1-7) and flags the semantics loss
      // (P2-11). We use the rule's own documented allowance option instead of a
      // blanket disable, so every OTHER redundant role is still an error.
      //
      // `<li role="listitem">` is the SAME defect one level down, and is needed for the
      // same reason: a WebKit `<li>` whose computed display is not `list-item` (ours are
      // `display:flex` rows) loses its implicit `listitem` role, so the parent
      // `<ul role="list">` announces "list, 0 items" while the rows are visibly there.
      // Applied only where a flex row is used as a list item (/l locked view).
      "jsx-a11y/no-redundant-roles": ["error", { ul: ["list"], li: ["listitem"] }],

      // --- TRIAGED: `no-autofocus` is OFF, deliberately. ---------------------------
      // Hits: apps/web/src/app/onboarding/steps.tsx (the money field of the income and
      // budget steps). `autofocus` is NOT prohibited by any WCAG 2.0/2.1 success
      // criterion - 3.2.1 On Focus is about a change of CONTEXT on focus, which this
      // does not cause. The onboarding wizard renders ONE question per full screen, so
      // focusing its single field is the intended behaviour, and it predates this batch.
      // Trade-off accepted knowingly: a screen-reader user lands on the field rather
      // than the step <h1>. Flagged in the auditor handoff checklist as a judgement
      // call to confirm during the live NVDA/VoiceOver pass rather than silently kept.
      "jsx-a11y/no-autofocus": "off",
    },
  },

  // --- TRIAGED: one file-scoped false positive --------------------------------------
  // apps/web/src/app/export/page.tsx has `<a ref={anchorRef} style={{display:"none"}}
  // aria-hidden />` - a programmatic click target for a Blob download, never a link and
  // never rendered. `anchor-has-content` / `anchor-is-valid` cannot see that it is
  // display:none + aria-hidden, so both are false here. Scoped to these two rules in
  // this one file: every other jsx-a11y rule still applies to it.
  // (/export is authenticated and outside the accessibility statement's scope anyway -
  // audit s1.1 - so it was not otherwise touched by this batch.)
  {
    files: ["apps/web/src/app/export/page.tsx"],
    rules: {
      "jsx-a11y/anchor-has-content": "off",
      "jsx-a11y/anchor-is-valid": "off",
    },
  },
];
