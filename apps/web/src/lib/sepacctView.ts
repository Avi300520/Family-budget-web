import type { SeparateAccountsArrangement, SeparateAccountsFinancialCycle } from "@shopping-assistant/shared-types";

export function separateAccountsStateTitle(state: SeparateAccountsArrangement["state"]): string {
  switch (state) {
    case "absent": return "";
    case "joint": return "מנהלים יחד";
    case "pending": return "מחכים למבוגר/ת נוסף/ת";
    case "live": return "החלוקה פעילה";
    case "stalled": return "צריך לתקן את היחס";
    case "inactive": return "החלוקה כבויה";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function shouldShowSeparateAccountsCard(
  cycle: SeparateAccountsFinancialCycle | undefined
): cycle is SeparateAccountsFinancialCycle & { viewerShareAgorot: number } {
  return Boolean(cycle && cycle.allocatedExpenseCount > 0 && cycle.viewerShareAgorot !== null);
}

export function uniformViewerPercentage(cycle: SeparateAccountsFinancialCycle): string | null {
  if (cycle.uniformViewerShareBp === null) return null;
  return `${(cycle.uniformViewerShareBp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}
