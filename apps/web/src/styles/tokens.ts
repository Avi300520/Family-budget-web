/**
 * TS mirror of `tokens.css` — exposes the same names as `var(--…)` strings
 * so React/SVG components can consume them without duplicating any value.
 *
 * Rule: if a hex code or pixel value lives here, it's a bug — go change
 * `tokens.css` and reference it via `var(--…)`.
 */

export const tokens = {
  colors: {
    cream0: "var(--cream-0)",
    cream1: "var(--cream-1)",
    cream2: "var(--cream-2)",
    cream3: "var(--cream-3)",
    cream4: "var(--cream-4)",

    ink0: "var(--ink-0)",
    ink1: "var(--ink-1)",
    ink2: "var(--ink-2)",

    text0: "var(--text-0)",
    text1: "var(--text-1)",
    text2: "var(--text-2)",
    text3: "var(--text-3)",

    teal:      "var(--teal)",
    tealDark:  "var(--teal-dark)",
    tealSoft:  "var(--teal-soft)",
    tealBg:    "var(--teal-bg)",

    coral:     "var(--coral)",
    coralDark: "var(--coral-dark)",
    coralSoft: "var(--coral-soft)",
    coralBg:   "var(--coral-bg)",

    mustard:     "var(--mustard)",
    mustardSoft: "var(--mustard-soft)",
    mustardBg:   "var(--mustard-bg)",

    sage:     "var(--sage)",
    sageSoft: "var(--sage-soft)",
    sageBg:   "var(--sage-bg)",

    berry:     "var(--berry)",
    berrySoft: "var(--berry-soft)",
    berryBg:   "var(--berry-bg)",

    plum:     "var(--plum)",
    plumSoft: "var(--plum-soft)",
    plumBg:   "var(--plum-bg)",

    ocean:     "var(--ocean)",
    oceanSoft: "var(--ocean-soft)",
    oceanBg:   "var(--ocean-bg)",

    pos:    "var(--pos)",
    posBg:  "var(--pos-bg)",
    neg:    "var(--neg)",
    negBg:  "var(--neg-bg)",
    warn:   "var(--warn)",
    warnBg: "var(--warn-bg)"
  },
  members: {
    mom:  "var(--m-mom)",
    dad:  "var(--m-dad)",
    teen: "var(--m-teen)",
    kid:  "var(--m-kid)",
    kid2: "var(--m-kid2)"
  },
  space: {
    1: "var(--sp-1)",
    2: "var(--sp-2)",
    3: "var(--sp-3)",
    4: "var(--sp-4)",
    5: "var(--sp-5)",
    6: "var(--sp-6)",
    8: "var(--sp-8)",
    10: "var(--sp-10)",
    12: "var(--sp-12)",
    16: "var(--sp-16)"
  },
  radius: {
    1: "var(--r-1)",
    2: "var(--r-2)",
    3: "var(--r-3)",
    4: "var(--r-4)",
    5: "var(--r-5)",
    6: "var(--r-6)"
  },
  elev: {
    1: "var(--elev-1)",
    2: "var(--elev-2)",
    3: "var(--elev-3)"
  },
  font: {
    ui:   "var(--font-ui)",
    mono: "var(--font-mono)"
  },
  motion: {
    dur1: "var(--dur-1)",
    dur2: "var(--dur-2)",
    ease: "var(--ease)"
  }
} as const;

export type MemberColorKey = keyof typeof tokens.members;
