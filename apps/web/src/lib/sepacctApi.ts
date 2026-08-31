// SEPACCT — the wire. Nine routes, described in SEPACCT_FRONTEND_SPEC.md at the repository root;
// § numbers below refer to it. This file replaced `sepacctMock.ts`, which is deleted rather than
// kept beside it: a mock that survives the swap becomes what the next reader learns from.
//
// Everything goes through `api.request`, so SEPACCT inherits the session cookie, the CSRF header
// and the one-shot csrf self-heal the rest of the app already has. The api-client is a SYNCED
// copy of the backend's and is never hand-edited, so the routes live here instead of in it.

"use client";

import { ApiClientError } from "@shopping-assistant/api-client";
import { api } from "./api";
import { SepacctError } from "./sepacct";

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

/**
 * The api-client raises `ApiClientError`; SEPACCT surfaces branch on `SepacctError` via `isAbsent`,
 * and `sepacct.ts` stays importable by `node --experimental-strip-types` for its test. One mapper,
 * so a 404 arrives at every page as the same thing it was under the mock.
 *
 * Anything that is not an `ApiClientError` — a TypeError from a dead origin, a CORS refusal — is
 * rethrown untouched. Those are failures and must NOT be mistaken for the dormant 404 (§3).
 */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await api.request<T>(path, init);
  } catch (cause) {
    if (cause instanceof ApiClientError) throw new SepacctError(cause.code, cause.message);
    throw cause;
  }
}

const body = (value: unknown) => ({ body: JSON.stringify(value) });

export const sepacct = {
  /**
   * §1 — GET /households/current/separate-accounts. `current`, NOT an id: this is the only SEPACCT
   * route keyed that way and the PUT below is keyed by id. The asymmetry is real; do not "fix" it.
   * 🔴 **NOT MANAGER-ONLY, AND THIS COMMENT SAID IT WAS.** §A49 opened the read: verified at
   * `household-routes.ts:454-470`, which runs `arrangementAuth` and then refuses only a
   * `limited_member`. The asymmetry is that the **PUT** is manager-only (`:485`) while this GET
   * answers any active adult — deliberately, so a partner who did not configure the arrangement can
   * still see what it is. A `403 auth.forbidden` from HERE means a CHILD, not a non-manager, and it
   * is still not absence.
   *
   * It mattered: this sentence was the stated reason `/shared-expenses` seeds its first split at
   * 50/50 instead of the household ratio, and the reason two other files avoid reading the roster
   * from here. The behaviour those files chose is still fine; the reason given for it was not.
   */
  getConfig: () => call<SepacctConfigDto>("/api/v1/households/current/separate-accounts"),

  /** §1 — PUT /households/:householdId/separate-accounts. Returns the same body as the GET. */
  saveConfig: (householdId: string, next: Pick<SepacctConfigDto, "separateAccounts" | "defaultSplit">) =>
    call<SepacctConfigDto>(`/api/v1/households/${householdId}/separate-accounts`, { method: "PUT", ...body(next) }),

  /** §2 — GET …/purchases/:purchaseId/split. Child caller: `404 split.not_found`. */
  getSplit: (householdId: string, purchaseId: string) =>
    call<PurchaseSplitDto>(`/api/v1/households/${householdId}/purchases/${purchaseId}/split`),

  /** §2 — PUT …/split. Returns the same body as the GET. */
  setSplit: (householdId: string, purchaseId: string, shares: ReadonlyArray<{ userId: string; shareBp: number }>) =>
    call<PurchaseSplitDto>(`/api/v1/households/${householdId}/purchases/${purchaseId}/split`, {
      method: "PUT",
      ...body({ shares }),
    }),

  /**
   * §2 / §6 #4 — POST …/split/dispute marks the CALLER's own share and returns an EMPTY BODY, not
   * the updated allocation. `Promise<void>` so no call site can await a shape that never arrives;
   * re-GET the split afterwards.
   */
  disputeMyShare: async (householdId: string, purchaseId: string): Promise<void> => {
    await call<unknown>(`/api/v1/households/${householdId}/purchases/${purchaseId}/split/dispute`, { method: "POST" });
  },

  /** §3 — GET …/my-income. Self only, at every role. `{ monthlyAgorot: null }` for a child. */
  getOwnIncome: (householdId: string) => call<OwnIncomeDto>(`/api/v1/households/${householdId}/my-income`),

  /** §3 — PUT …/my-income. `null` clears it; a float is `400 income.invalid`, so send agorot. */
  saveOwnIncome: (householdId: string, monthlyAgorot: number | null) =>
    call<OwnIncomeDto>(`/api/v1/households/${householdId}/my-income`, { method: "PUT", ...body({ monthlyAgorot }) }),

  /** §4 — GET …/my-components. The two totals plus the settled pair, and NO range parameter. */
  getMyComponents: (householdId: string) => call<MyComponentsDto>(`/api/v1/households/${householdId}/my-components`),

  /**
   * §4 — GET …/my-record-components?from=&to=. The itemised list. BOTH bounds are REQUIRED and
   * `from <= to`, or the server answers `400 split.invalid`.
   */
  getMyRecordComponents: (householdId: string, from: string, to: string) =>
    call<RecordComponentsDto>(
      `/api/v1/households/${householdId}/my-record-components?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
};
