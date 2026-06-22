// Run with: node --experimental-strip-types --test src/lib/insightsPreview.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { WeeklyInsight } from "@shopping-assistant/shared-types";
import { selectInsightPreview } from "./insightsPreview.ts";

const real = (kind: WeeklyInsight["kind"]): WeeklyInsight => ({ kind, headlineHe: kind });
const empty: WeeklyInsight = { kind: "empty_state", headlineHe: "עוד אין הוצאות השבוע" };

test("empty week → isEmpty, no cards, surfaces backend empty headline", () => {
  const r = selectInsightPreview([empty], 3);
  assert.equal(r.isEmpty, true);
  assert.equal(r.cards.length, 0);
  assert.equal(r.emptyHeadlineHe, "עוד אין הוצאות השבוע");
});

test("undefined / no data → empty, no crash", () => {
  const r = selectInsightPreview(undefined, 3);
  assert.equal(r.isEmpty, true);
  assert.equal(r.cards.length, 0);
});

test("non-empty week → preview is first N real cards, empty_state filtered out", () => {
  const stack = [real("total_spend"), real("week_over_week"), real("top_category"), real("top_member"), real("streak_days")];
  const r = selectInsightPreview(stack, 3);
  assert.equal(r.isEmpty, false);
  assert.deepEqual(r.cards.map((c) => c.kind), ["total_spend", "week_over_week", "top_category"]);
});

test("fewer real cards than max → returns all of them", () => {
  const r = selectInsightPreview([real("total_spend"), real("purchase_count")], 3);
  assert.equal(r.cards.length, 2);
  assert.equal(r.isEmpty, false);
});

test("mixed stack with a stray empty_state is treated as non-empty and strips it", () => {
  const r = selectInsightPreview([real("total_spend"), empty], 3);
  assert.equal(r.isEmpty, false);
  assert.deepEqual(r.cards.map((c) => c.kind), ["total_spend"]);
});
