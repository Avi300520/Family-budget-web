// =============================================================================
// Dashboard insights-preview policy — pure, runtime-import-free (only `import
// type`), so it loads under `node --experimental-strip-types --test` (same
// constraint as mobileNav.ts / settingsView.ts). Decides ONLY which insights the
// small dashboard card shows; it never fetches and never decides visibility, so
// it cannot re-expose anything role-gated.
//
// Backend contract (apps/api/src/insights.ts): when the week has no purchases the
// stack is exactly one `{kind:'empty_state'}` card; otherwise the first card is
// `total_spend` followed by the most interesting insights. So the preview = first
// N NON-empty-state cards, and `isEmpty` is true iff every card is an empty_state.
// =============================================================================
import type { WeeklyInsight } from "@shopping-assistant/shared-types";

export function selectInsightPreview(
  insights: readonly WeeklyInsight[] | undefined,
  max = 3
): { cards: WeeklyInsight[]; isEmpty: boolean; emptyHeadlineHe?: string } {
  const list = insights ?? [];
  const real = list.filter((i) => i.kind !== "empty_state");
  if (real.length === 0) {
    const empty = list.find((i) => i.kind === "empty_state");
    return { cards: [], isEmpty: true, emptyHeadlineHe: empty?.headlineHe };
  }
  return { cards: real.slice(0, max), isEmpty: false };
}
