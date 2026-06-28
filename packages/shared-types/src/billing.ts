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
  /** Max children (limited_member) this tier covers; null = unlimited. */
  childrenMax: number | null;
}

/** 20-day free trial (was 14; product decision 2026-06-17). This constant is the
 *  SINGLE source of truth — the store reads it directly; there is no env override. */
export const TRIAL_DAYS = 20;

export const PLAN_PRICEBOOK: Readonly<Record<PaidPlanCode, BillingPlan>> = {
  couple_monthly:       { code: "couple_monthly",       tier: "couple",       interval: "monthly", priceAgorot: 1990,  currency: "ILS", childrenMax: 0 },
  couple_yearly:        { code: "couple_yearly",        tier: "couple",       interval: "yearly",  priceAgorot: 19900, currency: "ILS", childrenMax: 0 },
  family_small_monthly: { code: "family_small_monthly", tier: "family_small", interval: "monthly", priceAgorot: 2990,  currency: "ILS", childrenMax: 3 },
  family_small_yearly:  { code: "family_small_yearly",  tier: "family_small", interval: "yearly",  priceAgorot: 29900, currency: "ILS", childrenMax: 3 },
  family_large_monthly: { code: "family_large_monthly", tier: "family_large", interval: "monthly", priceAgorot: 3990,  currency: "ILS", childrenMax: null },
  family_large_yearly:  { code: "family_large_yearly",  tier: "family_large", interval: "yearly",  priceAgorot: 39900, currency: "ILS", childrenMax: null }
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

// ── Pure billing-state math (testable; all take `nowMs` — never call Date.now here) ──

/** Minimal structural view of a subscription row — avoids a type cycle with index.ts. */
export interface BillingStateInput {
  status: string;
  planCode: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
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
      return !Number.isNaN(ends) && ends <= nowMs ? "past_due" : "active";
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
  reason: string;
}
