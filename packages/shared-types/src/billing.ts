// Canonical, provider-agnostic billing model — the SINGLE source of truth for
// plan tiers, prices, the 20-day trial, and pure billing-state math. Pure TS,
// zero deps: synced to the frontend (sync:shared) so web + admin render the
// SAME pricebook the backend enforces. The server NEVER trusts a client-supplied
// price, tier, plan code, status, or trial date — those come from here / the DB.
//
// Replaces the old usage-metered `plus` / `family_pro` concept (deprecated, kept
// only as legacy PlanCode members for existing rows). New model = household
// composition tiers driven by active child (limited_member) count.

export type BillingTier = "couple" | "family_small" | "family_large";
export type BillingInterval = "monthly" | "yearly";

/** Canonical paid plan codes = `${tier}_${interval}`. `trial` is never purchasable. */
export type PaidPlanCode =
  | "couple_monthly"
  | "couple_yearly"
  | "family_small_monthly"
  | "family_small_yearly"
  | "family_large_monthly"
  | "family_large_yearly";

export interface BillingPlan {
  code: PaidPlanCode;
  tier: BillingTier;
  interval: BillingInterval;
  /** Price in agorot (integer minor units). NEVER store/compare money as float. */
  priceAgorot: number;
  currency: "ILS";
  /** Max children (limited_member) this tier covers; null = unlimited.
   *  Kept for the "suggested tier" UX; enforcement now switches to memberMax. */
  childrenMax: number | null;
  /** Owner-approved cap on TOTAL active household members (owner+adult+limited).
   *  couple 2 / family_small 4 / family_large 12 (public "4+"). Never null. */
  memberMax: number;
  /** Receipt scans allowed per MONTHLY usage window; null = unlimited (no product
   *  cap — family_large). Usage resets monthly even for annual_prepaid plans. */
  receiptsPerMonth: number | null;
}

/** 20-day free trial (was 14; product decision 2026-06-17). This constant is the
 *  SINGLE source of truth — the store reads it directly; there is no env override. */
export const TRIAL_DAYS = 20;

export const PLAN_PRICEBOOK: Readonly<Record<PaidPlanCode, BillingPlan>> = {
  couple_monthly:       { code: "couple_monthly",       tier: "couple",       interval: "monthly", priceAgorot: 1990,  currency: "ILS", childrenMax: 0,    memberMax: 2,  receiptsPerMonth: 40 },
  couple_yearly:        { code: "couple_yearly",        tier: "couple",       interval: "yearly",  priceAgorot: 19900, currency: "ILS", childrenMax: 0,    memberMax: 2,  receiptsPerMonth: 40 },
  family_small_monthly: { code: "family_small_monthly", tier: "family_small", interval: "monthly", priceAgorot: 2990,  currency: "ILS", childrenMax: 3,    memberMax: 4,  receiptsPerMonth: 70 },
  family_small_yearly:  { code: "family_small_yearly",  tier: "family_small", interval: "yearly",  priceAgorot: 29900, currency: "ILS", childrenMax: 3,    memberMax: 4,  receiptsPerMonth: 70 },
  family_large_monthly: { code: "family_large_monthly", tier: "family_large", interval: "monthly", priceAgorot: 3990,  currency: "ILS", childrenMax: null, memberMax: 12, receiptsPerMonth: null },
  family_large_yearly:  { code: "family_large_yearly",  tier: "family_large", interval: "yearly",  priceAgorot: 39900, currency: "ILS", childrenMax: null, memberMax: 12, receiptsPerMonth: null }
};

export const BILLING_PLANS: readonly BillingPlan[] = Object.values(PLAN_PRICEBOOK);

/** Pricebook lookup. Returns undefined for `trial` / legacy / unknown codes. */
export function planForCode(code: string): BillingPlan | undefined {
  return (PLAN_PRICEBOOK as Record<string, BillingPlan>)[code];
}

const TIER_RANK: Record<BillingTier, number> = { couple: 0, family_small: 1, family_large: 2 };
export function tierRank(tier: BillingTier): number {
  return TIER_RANK[tier];
}

/** Required tier from active child (limited_member) count. Pure, server-authoritative. */
export function requiredTierForChildren(childCount: number): BillingTier {
  if (childCount <= 0) return "couple";
  if (childCount <= 3) return "family_small";
  return "family_large";
}

/** Does a purchased plan tier cover this child count? */
export function tierCoversChildren(tier: BillingTier, childCount: number): boolean {
  return tierRank(tier) >= tierRank(requiredTierForChildren(childCount));
}

// ── Total active-member cap (owner-approved: couple 2 / family_small 4 / family_large 12) ──
// The pricebook (`memberMax`) is the SINGLE source of truth so the cap can never drift
// from the DB `plans.member_max` seed. `childrenMax` above stays for the suggested-tier UX.

/** Total active-member cap for a tier, read from the pricebook (same for monthly+yearly). */
export function memberCapForTier(tier: BillingTier): number {
  const plan = BILLING_PLANS.find((p) => p.tier === tier);
  return plan ? plan.memberMax : 0;
}

/** Suggested tier from total active member count. Pure, server-authoritative. */
export function requiredTierForMembers(memberCount: number): BillingTier {
  if (memberCount <= memberCapForTier("couple")) return "couple";
  if (memberCount <= memberCapForTier("family_small")) return "family_small";
  return "family_large";
}

/** Does a purchased plan tier cover this TOTAL active-member count? */
export function tierCoversMemberCount(tier: BillingTier, memberCount: number): boolean {
  return memberCount <= memberCapForTier(tier);
}

// ── Billing period vs usage period (two independent clocks; see plan §5) ──
// `interval` already encodes the billing period: "monthly" = +1mo access,
// "yearly" = annual_prepaid (+12mo access, ONE-TIME, no auto-renew in phase 1).
// The usage period is ALWAYS monthly — an annual subscriber still resets their
// 40/70 receipts every month (NOT 12x up front) — so it is a constant, not a field.
export const USAGE_PERIOD_MONTHS = 1;

/** Months of paid access one purchase buys: monthly = 1, yearly (annual prepaid) = 12. */
export function billingPeriodMonths(interval: BillingInterval): number {
  return interval === "yearly" ? 12 : 1;
}

/** Advance an ISO timestamp by N calendar months (day-of-month anchored; JS Date handles
 *  month-length + leap-year overflow). Pure — drives the monthly receipt usage window in both
 *  stores (enforcement roll) and the status DTO (display roll), so they stay consistent. */
export function addMonths(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// ── Pure billing-state math (testable; all take `nowMs` — never call Date.now here) ──

/** Minimal structural view of a subscription row — avoids a type cycle with index.ts. */
export interface BillingStateInput {
  status: string;
  planCode: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  /** True once the household asked to cancel (access continues to currentPeriodEnd, then ends).
   *  Distinguishes a cancelling-but-still-paid sub from a lapsed one at period end. */
  cancelAtPeriodEnd?: boolean;
}

export type EffectiveBillingStatus =
  | "trialing"
  | "active"
  | "trial_expired"
  | "past_due"
  | "expired"
  | "cancelled"
  | "paused"
  | "none";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lazy effective status: a `trialing`/`active` sub whose window has elapsed reads
 *  as `trial_expired`/`past_due` even if no sweep has flipped the stored row — so
 *  reads are correct without a cron. `nowMs` is the current time in ms. */
export function computeEffectiveStatus(sub: BillingStateInput | undefined | null, nowMs: number): EffectiveBillingStatus {
  if (!sub) return "none";
  switch (sub.status) {
    case "trialing": {
      const ends = sub.trialEndsAt ? Date.parse(sub.trialEndsAt) : NaN;
      return !Number.isNaN(ends) && ends <= nowMs ? "trial_expired" : "trialing";
    }
    case "active": {
      const ends = sub.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : NaN;
      if (Number.isNaN(ends) || ends > nowMs) return "active";
      // Period elapsed. A sub the user asked to cancel ends as `cancelled` (no renewal was intended);
      // otherwise it is `past_due` (renewal expected/awaited). The stored row stays 'active' either way
      // — this lazy read-time flip means no cron is needed to end access at the paid period boundary.
      return sub.cancelAtPeriodEnd ? "cancelled" : "past_due";
    }
    case "past_due": return "past_due";
    case "cancelled": return "cancelled";
    case "expired": return "expired";
    case "paused": return "paused";
    default: return "none";
  }
}

/** True when the household is entitled to paid features (active trial or paid). */
export function isBillingEntitled(effective: EffectiveBillingStatus): boolean {
  return effective === "trialing" || effective === "active";
}

/** Whole days left in the trial (ceil, floored at 0); null when not trialing. */
export function trialDaysRemaining(sub: BillingStateInput | undefined | null, nowMs: number): number | null {
  if (!sub || sub.status !== "trialing" || !sub.trialEndsAt) return null;
  const ends = Date.parse(sub.trialEndsAt);
  if (Number.isNaN(ends)) return null;
  return Math.max(0, Math.ceil((ends - nowMs) / DAY_MS));
}

// ── Enforcement / capability resolution ──────────────────────────────────────

export type BillingEnforcementMode = "off" | "soft" | "hard";

export interface BillingCapabilities {
  /** May the household use paid/metered features right now? */
  serviceAllowed: boolean;
  /** Reason code for UI + WhatsApp copy (never a raw status). */
  reason: string;
  effectiveStatus: EffectiveBillingStatus;
}

/** Central capability resolution. When enforcement is `off`/`soft`, service is
 *  always allowed (observe-only) — only `hard` actually blocks. The effective
 *  status + reason are always computed for telemetry/UI regardless of mode. */
export function resolveCapabilities(
  sub: BillingStateInput | undefined | null,
  enforcement: BillingEnforcementMode,
  nowMs: number
): BillingCapabilities {
  const effectiveStatus = computeEffectiveStatus(sub, nowMs);
  const entitled = isBillingEntitled(effectiveStatus);
  const serviceAllowed = enforcement === "hard" ? entitled : true;
  const reason = entitled
    ? (effectiveStatus === "trialing" ? "billing.trial_active" : "billing.active")
    : effectiveStatus === "trial_expired" ? "billing.trial_expired"
    : effectiveStatus === "past_due" ? "billing.past_due"
    : effectiveStatus === "expired" ? "billing.subscription_expired"
    : effectiveStatus === "cancelled" ? "billing.subscription_cancelled"
    : "billing.no_subscription";
  return { serviceAllowed, reason, effectiveStatus };
}

/** Pure receipt-scan gate decision shared by MemoryStore + PostgresStore so both
 *  enforce IDENTICALLY. Rules: enforcement off/soft NEVER block (observe-only);
 *  trial is unconditionally unlimited; an active plan uses its receiptsPerMonth
 *  (null = unlimited, e.g. family_large); anything else (expired/past_due/none)
 *  blocks only in hard mode. The monthly window roll + counter live in the store. */
export function receiptScanBlocked(args: {
  effectiveStatus: EffectiveBillingStatus;
  planCode: string;
  usedValue: number;
  enforcement: BillingEnforcementMode;
}): { blocked: boolean; reason: "premium_inactive" | "limit" | null } {
  if (args.enforcement !== "hard") return { blocked: false, reason: null };
  if (args.effectiveStatus === "trialing") return { blocked: false, reason: null }; // trial = unlimited
  if (args.effectiveStatus !== "active") return { blocked: true, reason: "premium_inactive" };
  const limit = planForCode(args.planCode)?.receiptsPerMonth ?? null;
  if (limit !== null && args.usedValue >= limit) return { blocked: true, reason: "limit" };
  return { blocked: false, reason: null };
}

/** Household-facing billing status DTO (returned by GET /billing/subscription). */
export interface BillingStatusDto {
  effectiveStatus: EffectiveBillingStatus;
  planCode: string;
  tier: BillingTier | null;
  trialDaysRemaining: number | null;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  /** Tier the household must be on given its current child count. */
  requiredTier: BillingTier;
  childCount: number;
  /** True when child count exceeds the purchased tier (upgrade needed). */
  upgradeRequired: boolean;
  // ── Member-cap usage (total active members vs the plan's memberMax) ──
  /** Total active members (owner+adult+limited) in the household right now. */
  memberCount: number;
  /** Plan's total-member cap; null during trial (unlimited) or when no plan. */
  memberMax: number | null;
  /** True when active member count has reached/exceeded memberMax (hard-mode blocks adds). */
  memberLimitReached: boolean;
  // ── Receipt-cap usage (monthly window; null = unlimited / trial) ──
  /** Receipt scans allowed this monthly window; null = unlimited (trial or family_large). */
  receiptsPerMonth: number | null;
  /** Receipt scans used in the current monthly window. */
  receiptsUsed: number;
  /** When the monthly receipt window resets (ISO); null when unmetered (trial/unlimited). */
  receiptsResetAt: string | null;
  reason: string;
}
