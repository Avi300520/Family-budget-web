import assert from "node:assert/strict";
import test from "node:test";
import type { SeparateAccountsFinancialCycle } from "@shopping-assistant/shared-types";
import { separateAccountsStateTitle, shouldShowSeparateAccountsCard, uniformViewerPercentage } from "./sepacctView.ts";

const cycle = (overrides: Partial<SeparateAccountsFinancialCycle> = {}): SeparateAccountsFinancialCycle => ({
  from: "2026-09-01",
  to: "2026-09-30",
  recordedAgorot: 0,
  viewerShareAgorot: 0,
  allocatedExpenseCount: 1,
  sharedExpenseCount: 1,
  uniformViewerShareBp: 0,
  unallocated: [],
  entries: [],
  ...overrides
});

test("all six arrangement states have an exhaustive presentation", () => {
  assert.deepEqual(
    ["absent", "joint", "pending", "live", "stalled", "inactive"].map((state) => separateAccountsStateTitle(state as never)),
    ["", "מנהלים יחד", "מחכים למבוגר/ת נוסף/ת", "החלוקה פעילה", "צריך לתקן את היחס", "החלוקה כבויה"]
  );
});

test("a computed zero is present, while not-computed omits the card", () => {
  assert.equal(shouldShowSeparateAccountsCard(cycle()), true);
  assert.equal(shouldShowSeparateAccountsCard(cycle({ allocatedExpenseCount: 0, viewerShareAgorot: null })), false);
  assert.equal(shouldShowSeparateAccountsCard(cycle({ allocatedExpenseCount: 1, viewerShareAgorot: null })), false);
});

test("a percentage is displayed only when the server proves it uniform", () => {
  assert.equal(uniformViewerPercentage(cycle({ uniformViewerShareBp: 3333 })), "33.33%");
  assert.equal(uniformViewerPercentage(cycle({ uniformViewerShareBp: 0 })), "0%");
  assert.equal(uniformViewerPercentage(cycle({ uniformViewerShareBp: null })), null);
});
