/**
 * InsightCard — single Iteration 7 insight tile.
 *
 * Presentational only. Hebrew copy comes from the server (`headlineHe`); the
 * Frontend never composes Hebrew strings here. Member-identity cards render
 * the Iteration 6 Avatar with the persisted colour key.
 *
 * Reuses existing primitives (.panel, .muted, .h3) — no new CSS tokens.
 */

import type { WeeklyInsight } from "@shopping-assistant/shared-types";
import type { MemberColorKey } from "../styles/tokens";
import { Avatar } from "./Avatar";

const KIND_ICON: Record<WeeklyInsight["kind"], string> = {
  total_spend:      "💰",
  week_over_week:   "📊",
  top_category:     "🛒",
  top_member:       "⭐",
  busiest_weekday:  "📅",
  purchase_count:   "✍️",
  streak_days:      "🔥",
  empty_state:      "🌿"
};

export function InsightCard({
  insight,
  memberDisplayName,
  memberColor
}: {
  insight: WeeklyInsight;
  /** When kind === "top_member", supply the member's display name and DB color. */
  memberDisplayName?: string;
  memberColor?: MemberColorKey | null;
}) {
  return (
    <section
      className="panel"
      style={{
        padding: "var(--sp-5)",
        display: "flex",
        gap: "var(--sp-4)",
        alignItems: "center"
      }}
      data-kind={insight.kind}
    >
      {insight.kind === "top_member" && insight.memberId ? (
        <Avatar
          memberId={insight.memberId}
          displayName={memberDisplayName}
          colorKey={memberColor ?? null}
          size="lg"
        />
      ) : (
        <span style={{ fontSize: 36 }} aria-hidden="true">
          {KIND_ICON[insight.kind]}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{insight.headlineHe}</div>
      </div>
    </section>
  );
}
