// A local stand-in for the eight SEPACCT routes, shaped like the wire and nothing else.
//
// !! THIS FILE IS TEMPORARY AND IS DELETED, NOT EDITED, WHEN THE ROUTES ARE WIRED. !!
// Its whole job is to make that a SWAP rather than a rewrite: every method below has the
// signature, the response shape and the failure codes of the route it stands for, as described in
// SEPACCT_FRONTEND_SPEC.md (§ numbers below refer to it). While the feature is disarmed every
// method here answers exactly what the wire answers - 404 http.not_found - so no production build
// can serve a byte of it. See SEPACCT_UI_ENABLED in ./sepacct.
//
// The mock was previously shaped like a convenient client rather than like the API, and taught
// four pages a shape that does not exist. The differences it used to carry are §6's eight, and
// each is now closed at the point it appeared.

import { SEPACCT_UI_ENABLED, SepacctError } from "./sepacct";

export type SepacctPreviewState = "loading" | "error" | "empty" | "dormant" | "window" | "populated";

export type SepacctRole = "owner" | "admin" | "adult_member" | "limited_member";

/** §1 — `members` lists ACTIVE members, children included; `defaultSplit` may not name one. */
export interface SepacctMemberDto {
  userId: string;
  displayName: string; // may be "" — every call site needs a fallback
  role: SepacctRole;
}

export interface SepacctConfigDto {
  separateAccounts: boolean;
  members: SepacctMemberDto[];
  defaultSplit: Array<{ userId: string; shareBp: number }>;
}

/** §2 — no `displayName`: join `userId` against the arrangement's `members` (§6 #1). */
export interface SplitShareDto {
  userId: string;
  shareBp: number;
  /** Server-resolved. Render VERBATIM; never recompute from shareBp × total (§2). */
  agorot: number;
  previousShareBp: number | null;
  disputedAt: string | null;
}

export interface SplitPurchaseDto {
  id: string;
  merchantNameRaw: string | null;
  purchaseDate: string;
  /** Who recorded it — a UUID, nullable, not a display name (§6 #6). */
  userId: string | null;
}

export interface PurchaseAllocationDto {
  purchaseId: string;
  totalAgorot: number;
  shares: SplitShareDto[];
}

/** §2 — the split GET is a wrapper, and `allocation: null` is normal, not an error. */
export interface PurchaseSplitDto {
  purchase: SplitPurchaseDto;
  allocation: PurchaseAllocationDto | null;
}

/** §3 — explicitly `null` when unset, and `null` for a child. Never absent. */
export interface OwnIncomeDto {
  monthlyAgorot: number | null;
}

/** §4 — the two totals, from `my-components`, which takes NO range. */
export interface MyComponentsDto {
  recordedAgorot: number;
  shareAgorot: number;
  settledOutAgorot: number;
  settledInAgorot: number;
  /** Non-null ⇒ the totals START here and must be labelled as such on the same surface (§4). */
  windowOpenedAt: string | null;
}

/** §4 — the itemised list, from `my-record-components`, over a REQUIRED window on purchaseDate. */
export interface RecordEntryDto {
  purchaseId: string;
  merchantNameRaw: string | null;
  purchaseDate: string;
  recordedAgorot: number;
  myShareAgorot: number;
  disputedAt: string | null;
}

export interface RecordComponentsDto {
  entries: RecordEntryDto[];
}

export const MOCK_HOUSEHOLD_ID = "7bf6b573-6e69-4ec3-a6ba-8c0be3fbd9c5";
export const MOCK_VIEWER_ID = "98b1bf2e-3c99-4ca3-9a0a-7208f208bd9a";
const PARTNER_ID = "1147b716-97cc-4ce8-aa86-0ed39e36d7cf";
const CHILD_ID = "5f2c9d21-4a6e-42b7-9c31-6b0a7e8d4411";

/** A purchase that HAS a split. `?state=populated` on /shared-expenses lands here. */
export const MOCK_PURCHASE_ID = "26fabb47-5ff7-48fb-ab15-8589a5ec3b2d";
/** A purchase with `allocation: null`, `merchantNameRaw: null` and `userId: null` — all three
 *  fallbacks at once. `?state=empty` on /shared-expenses lands here. */
export const MOCK_UNSPLIT_PURCHASE_ID = "f0d3b8a5-1c47-4a92-8e6d-2b5c7a91d0f3";

/**
 * The server's allocation rule (§2): floor every part, then hand the remaining agora out by
 * `shareBp` descending, `userId` ascending, so the parts sum to exactly the whole.
 *
 * Exported for the test only. Pages must NOT call it — on the wire `agorot` arrives resolved and
 * recomputing it loses money on screen.
 */
export function resolveShares(
  totalAgorot: number,
  shares: ReadonlyArray<{ userId: string; shareBp: number }>,
): Array<{ userId: string; shareBp: number; agorot: number }> {
  const parts = shares.map((share) => ({ ...share, agorot: Math.floor((totalAgorot * share.shareBp) / 10000) }));
  let remainder = totalAgorot - parts.reduce((sum, part) => sum + part.agorot, 0);
  [...parts]
    .sort((a, b) => b.shareBp - a.shareBp || a.userId.localeCompare(b.userId))
    .forEach((part) => {
      if (remainder > 0) {
        part.agorot += 1;
        remainder -= 1;
      }
    });
  return parts;
}

let config: SepacctConfigDto = {
  separateAccounts: true,
  members: [
    { userId: MOCK_VIEWER_ID, displayName: "נועה", role: "owner" },
    { userId: PARTNER_ID, displayName: "אורי", role: "adult_member" },
    // A child is in `members` and must never be offered a share.
    { userId: CHILD_ID, displayName: "יעל", role: "limited_member" },
  ],
  defaultSplit: [
    { userId: MOCK_VIEWER_ID, shareBp: 5000 },
    { userId: PARTNER_ID, shareBp: 5000 },
  ],
};

let splits: Record<string, PurchaseSplitDto> = {
  [MOCK_PURCHASE_ID]: {
    purchase: { id: MOCK_PURCHASE_ID, merchantNameRaw: "סופר השכונה", purchaseDate: "2026-08-24", userId: PARTNER_ID },
    allocation: {
      purchaseId: MOCK_PURCHASE_ID,
      totalAgorot: 18670,
      shares: [
        { userId: MOCK_VIEWER_ID, shareBp: 5000, agorot: 9335, previousShareBp: null, disputedAt: null },
        { userId: PARTNER_ID, shareBp: 5000, agorot: 9335, previousShareBp: null, disputedAt: null },
      ],
    },
  },
  [MOCK_UNSPLIT_PURCHASE_ID]: {
    purchase: { id: MOCK_UNSPLIT_PURCHASE_ID, merchantNameRaw: null, purchaseDate: "2026-08-19", userId: null },
    allocation: null,
  },
};

let ownIncome: OwnIncomeDto = { monthlyAgorot: 1825000 };

const components: MyComponentsDto = {
  recordedAgorot: 250000,
  shareAgorot: 187000,
  settledOutAgorot: 0,
  settledInAgorot: 0,
  windowOpenedAt: null,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Dormant BY CONSTRUCTION, not only by convention. Every method opens with this, so a surface that
 * forgets its own SEPACCT_UI_ENABLED guard still gets the wire's disarmed answer and renders as
 * absent, rather than quietly serving a household somebody's invented merchant names.
 */
function armed(): void {
  if (!SEPACCT_UI_ENABLED) throw new SepacctError("http.not_found");
}

export function previewState(value: string | null): SepacctPreviewState {
  return value === "loading" || value === "error" || value === "empty" || value === "dormant" || value === "window"
    ? value
    : "populated";
}

export const sepacctMock = {
  /** GET /households/current/separate-accounts — `current`, not an id. Manager only (§1). */
  async getConfig(): Promise<SepacctConfigDto> {
    armed();
    return copy(config);
  },

  /** PUT /households/:householdId/separate-accounts — keyed by id, unlike the GET (§1). */
  async saveConfig(
    _householdId: string,
    next: Pick<SepacctConfigDto, "separateAccounts" | "defaultSplit">,
  ): Promise<SepacctConfigDto> {
    armed();
    const total = next.defaultSplit.reduce((sum, share) => sum + share.shareBp, 0);
    // §1: the sum rule applies ONLY when the arrangement is on.
    if (next.separateAccounts && (next.defaultSplit.length === 0 || total !== 10000)) {
      throw new SepacctError("split.invalid");
    }
    if (next.defaultSplit.some((share) => config.members.find((m) => m.userId === share.userId)?.role === "limited_member")) {
      throw new SepacctError("split.not_a_member");
    }
    config = { ...config, ...copy(next) };
    return copy(config);
  },

  /** GET /households/:householdId/purchases/:purchaseId/split (§2). */
  async getSplit(_householdId: string, purchaseId: string): Promise<PurchaseSplitDto> {
    armed();
    const found = splits[purchaseId];
    if (!found) throw new SepacctError("split.not_found");
    return copy(found);
  },

  /** PUT …/split — returns the same body as the GET (§2). */
  async setSplit(
    _householdId: string,
    purchaseId: string,
    shares: ReadonlyArray<{ userId: string; shareBp: number }>,
  ): Promise<PurchaseSplitDto> {
    armed();
    const found = splits[purchaseId];
    if (!found) throw new SepacctError("purchase.not_found");
    if (!Array.isArray(shares)) throw new SepacctError("split.invalid");
    const previous = found.allocation?.shares ?? [];
    const totalAgorot = found.allocation?.totalAgorot ?? 0;
    splits = {
      ...splits,
      [purchaseId]: {
        ...found,
        allocation: {
          purchaseId,
          totalAgorot,
          shares: resolveShares(totalAgorot, shares).map((part) => {
            const before = previous.find((share) => share.userId === part.userId);
            return {
              ...part,
              previousShareBp: before && before.shareBp !== part.shareBp ? before.shareBp : (before?.previousShareBp ?? null),
              disputedAt: before?.disputedAt ?? null,
            };
          }),
        },
      },
    };
    return copy(splits[purchaseId]!);
  },

  /** POST …/split/dispute — marks the CALLER's own share, and returns NOTHING (§2, §6 #4). */
  async disputeMyShare(_householdId: string, purchaseId: string): Promise<void> {
    armed();
    const found = splits[purchaseId];
    if (!found?.allocation) throw new SepacctError("split.not_found");
    splits = {
      ...splits,
      [purchaseId]: {
        ...found,
        allocation: {
          ...found.allocation,
          shares: found.allocation.shares.map((share) =>
            share.userId === MOCK_VIEWER_ID ? { ...share, disputedAt: share.disputedAt ?? "2026-08-27T09:15:00.000Z" } : share,
          ),
        },
      },
    };
  },

  /** GET /households/:householdId/my-income — self only, at every role (§3). */
  async getOwnIncome(_householdId: string): Promise<OwnIncomeDto> {
    armed();
    return copy(ownIncome);
  },

  /** PUT …/my-income — `null` clears it; a float is `400 income.invalid` (§3). */
  async saveOwnIncome(_householdId: string, monthlyAgorot: number | null): Promise<OwnIncomeDto> {
    armed();
    if (monthlyAgorot !== null && (!Number.isInteger(monthlyAgorot) || monthlyAgorot < 0)) {
      throw new SepacctError("income.invalid");
    }
    ownIncome = { monthlyAgorot };
    return copy(ownIncome);
  },

  /** GET /households/:householdId/my-components — the two totals, and NO range parameter (§4). */
  async getMyComponents(_householdId: string): Promise<MyComponentsDto> {
    armed();
    return copy(components);
  },

  /** GET …/my-record-components?from=&to= — the list, over a window that is REQUIRED (§4). */
  async getMyRecordComponents(_householdId: string, from: string, to: string): Promise<RecordComponentsDto> {
    armed();
    if (!DATE.test(from) || !DATE.test(to) || from > to) throw new SepacctError("split.invalid");
    const entries = Object.values(splits)
      .filter((split) => split.allocation && split.purchase.purchaseDate >= from && split.purchase.purchaseDate <= to)
      .flatMap((split) => {
        const mine = split.allocation!.shares.find((share) => share.userId === MOCK_VIEWER_ID);
        if (!mine) return [];
        return [
          {
            purchaseId: split.purchase.id,
            merchantNameRaw: split.purchase.merchantNameRaw,
            purchaseDate: split.purchase.purchaseDate,
            recordedAgorot: split.allocation!.totalAgorot,
            myShareAgorot: mine.agorot,
            disputedAt: mine.disputedAt,
          },
        ];
      });
    return copy({ entries });
  },
};
