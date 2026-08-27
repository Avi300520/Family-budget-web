export type SepacctPreviewState = "loading" | "error" | "empty" | "populated";

export interface SplitShareDto {
  userId: string;
  displayName: string;
  shareBp: number;
  agorot: number;
  disputedAt?: string;
  previousShareBp?: number;
}

export interface PurchaseAllocationDto {
  purchaseId: string;
  merchantName: string;
  purchaseDate: string;
  totalAgorot: number;
  recordedBy: string;
  shares: SplitShareDto[];
}

export interface SepacctConfigDto {
  separateAccounts: boolean;
  members: Array<{ userId: string; displayName: string; role: "owner" | "admin" | "adult_member" }>;
  defaultSplit: Array<{ userId: string; shareBp: number }>;
}

export interface OwnIncomeDto { monthlyAgorot?: number }

export interface RecordComponentsDto {
  recordedAgorot: number;
  shareAgorot: number;
  entries: PurchaseAllocationDto[];
}

export const MOCK_HOUSEHOLD_ID = "7bf6b573-6e69-4ec3-a6ba-8c0be3fbd9c5";
export const MOCK_VIEWER_ID = "98b1bf2e-3c99-4ca3-9a0a-7208f208bd9a";

let config: SepacctConfigDto = {
  separateAccounts: true,
  members: [
    { userId: MOCK_VIEWER_ID, displayName: "נועה", role: "owner" },
    { userId: "1147b716-97cc-4ce8-aa86-0ed39e36d7cf", displayName: "אורי", role: "adult_member" }
  ],
  defaultSplit: [
    { userId: MOCK_VIEWER_ID, shareBp: 5000 },
    { userId: "1147b716-97cc-4ce8-aa86-0ed39e36d7cf", shareBp: 5000 }
  ]
};

let allocation: PurchaseAllocationDto | undefined = {
  purchaseId: "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d",
  merchantName: "סופר השכונה",
  purchaseDate: "2026-08-24",
  totalAgorot: 18670,
  recordedBy: "אורי",
  shares: [
    { userId: MOCK_VIEWER_ID, displayName: "נועה", shareBp: 5000, agorot: 9335 },
    { userId: "1147b716-97cc-4ce8-aa86-0ed39e36d7cf", displayName: "אורי", shareBp: 5000, agorot: 9335 }
  ]
};

let ownIncome: OwnIncomeDto = { monthlyAgorot: 1825000 };

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function previewState(value: string | null): SepacctPreviewState {
  return value === "loading" || value === "error" || value === "empty" ? value : "populated";
}

export const sepacctMock = {
  async getConfig(): Promise<SepacctConfigDto> { return copy(config); },
  async saveConfig(next: Pick<SepacctConfigDto, "separateAccounts" | "defaultSplit">): Promise<SepacctConfigDto> {
    config = { ...config, ...copy(next) };
    return copy(config);
  },
  async getAllocation(): Promise<PurchaseAllocationDto | undefined> { return copy(allocation); },
  async setAllocation(shares: Array<{ userId: string; shareBp: number }>): Promise<PurchaseAllocationDto | undefined> {
    if (!allocation || shares.length === 0) { allocation = undefined; return undefined; }
    const total = allocation.totalAgorot;
    const ordered = shares.map((share) => ({ ...share, base: Math.floor((total * share.shareBp) / 10000) }));
    let remainder = total - ordered.reduce((sum, share) => sum + share.base, 0);
    [...ordered].sort((a, b) => b.shareBp - a.shareBp || a.userId.localeCompare(b.userId)).forEach((share) => {
      if (remainder > 0) { share.base += 1; remainder -= 1; }
    });
    allocation = {
      ...allocation,
      shares: ordered.map((share) => {
        const member = config.members.find((item) => item.userId === share.userId);
        const previous = allocation?.shares.find((item) => item.userId === share.userId)?.shareBp;
        return {
          userId: share.userId,
          displayName: member?.displayName ?? "חבר/ה",
          shareBp: share.shareBp,
          agorot: share.base,
          ...(previous !== undefined && previous !== share.shareBp ? { previousShareBp: previous } : {})
        };
      })
    };
    return copy(allocation);
  },
  async disputeMyShare(): Promise<PurchaseAllocationDto | undefined> {
    if (allocation) allocation = { ...allocation, shares: allocation.shares.map((share) => share.userId === MOCK_VIEWER_ID ? { ...share, disputedAt: share.disputedAt ?? new Date().toISOString() } : share) };
    return copy(allocation);
  },
  async getOwnIncome(): Promise<OwnIncomeDto> { return copy(ownIncome); },
  async saveOwnIncome(monthlyAgorot?: number): Promise<OwnIncomeDto> { ownIncome = monthlyAgorot === undefined ? {} : { monthlyAgorot }; return copy(ownIncome); },
  async getRecordComponents(): Promise<RecordComponentsDto> {
    const entry = allocation ? [copy(allocation)] : [];
    const ownShare = allocation?.shares.find((share) => share.userId === MOCK_VIEWER_ID)?.agorot ?? 0;
    return { recordedAgorot: allocation?.totalAgorot ?? 0, shareAgorot: ownShare, entries: entry };
  }
};
