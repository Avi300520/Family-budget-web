export const SEPARATE_ACCOUNT_STATES = ["absent", "joint", "pending", "live", "stalled", "inactive"] as const;

export type SeparateAccountState = (typeof SEPARATE_ACCOUNT_STATES)[number];
export type MoneyModeAnswer = "joint" | "separate";

export interface NamedSeparateAccountShare {
  userId: string;
  displayName: string;
  shareBp: number;
}

export interface SeparateAccountCapabilities {
  canChangeMode: boolean;
  canEditRatio: boolean;
  canDisable: boolean;
  canManageOwnIncome: boolean;
  canInviteAdult: boolean;
  canAllocateNewExpense: boolean;
}

export interface SeparateAccountHistoryMarkers {
  everLive: boolean;
  periodCount: number;
  currentTransitionId: string | null;
  lastTransitionAt: string | null;
}

interface ArrangementBase<S extends SeparateAccountState> {
  state: S;
  managerNames: string[];
  activeAdults: Array<{ userId: string; displayName: string }>;
  capabilities: SeparateAccountCapabilities;
  history: SeparateAccountHistoryMarkers;
}

export type SeparateAccountsArrangement =
  | ArrangementBase<"absent">
  | (ArrangementBase<"joint"> & { answeredAt: string | null })
  | (ArrangementBase<"pending"> & {
      configuredAt: string;
      shares: NamedSeparateAccountShare[];
      waitingForAnotherAdult: true;
    })
  | (ArrangementBase<"live"> & {
      configuredAt: string;
      liveSince: string;
      operatingPeriodId: string | null;
      shares: NamedSeparateAccountShare[];
    })
  | (ArrangementBase<"stalled"> & {
      configuredAt: string;
      stalledAt: string;
      reason: "named_non_adult" | "extra_adults" | "incomplete" | "single_adult";
      shares: NamedSeparateAccountShare[];
      repairerNames: string[];
    })
  | (ArrangementBase<"inactive"> & {
      configuredAt: string;
      disabledAt: string;
      lastLiveEndedAt: string | null;
      shares: NamedSeparateAccountShare[];
    });

export type PurchaseUnallocatedReason =
  | "child_payer"
  | "pending"
  | "inactive"
  | "stalled"
  | "missing_payer"
  | "ineligible_payer"
  | "allocation_failure";

export type FinancialCycleEntry =
  | { kind: "recorded_only"; purchaseId: string; merchantName: string | null; purchaseDate: string; recordedAgorot: number; viewerShareAgorot: null; allocationStatus: "allocated_to_others" | "unallocated"; unallocatedReason: PurchaseUnallocatedReason | null }
  | { kind: "share_only"; purchaseId: string; merchantName: string | null; purchaseDate: string; recordedAgorot: null; viewerShareAgorot: number; viewerShareBp: number }
  | { kind: "recorded_and_share"; purchaseId: string; merchantName: string | null; purchaseDate: string; recordedAgorot: number; viewerShareAgorot: number; viewerShareBp: number };

export interface SeparateAccountsFinancialCycle {
  from: string;
  to: string;
  recordedAgorot: number;
  viewerShareAgorot: number | null;
  allocatedExpenseCount: number;
  sharedExpenseCount: number;
  uniformViewerShareBp: number | null;
  unallocated: Array<{ reason: PurchaseUnallocatedReason; count: number; agorot: number }>;
  entries: FinancialCycleEntry[];
}
