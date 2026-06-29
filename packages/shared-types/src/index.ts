export * from "./shoppingCategories";
export * from "./financialBaseline";
export * from "./billing";

import type { ShoppingCategoryId } from "./shoppingCategories";
import type { FinancialBaseline } from "./financialBaseline";
import type { EffectiveBillingStatus } from "./billing";

export type Currency = "ILS";
export type UserStatus = "onboarding" | "active" | "blocked" | "deleted";
export type HouseholdStatus = "trial" | "active" | "suspended" | "cancelled" | "deleted";
export type HouseholdRole = "owner" | "admin" | "adult_member" | "limited_member";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired" | "paused";
// Subscription plan codes. Canonical = `trial` + the 6 composition-tier paid
// codes (see ./billing PaidPlanCode / PLAN_PRICEBOOK). The 4 legacy `plus_*` /
// `family_pro_*` codes are DEPRECATED (old usage-metered model) and retained only
// so existing DB rows and older tests still type-check — never offered for purchase.
export type PlanCode =
  | "trial"
  | "couple_monthly"
  | "couple_yearly"
  | "family_small_monthly"
  | "family_small_yearly"
  | "family_large_monthly"
  | "family_large_yearly"
  /** @deprecated legacy usage-metered codes — do not offer for new checkouts. */
  | "plus_monthly"
  | "plus_annual"
  | "family_pro_monthly"
  | "family_pro_annual";
export type ReceiptStatus = "uploaded" | "processing" | "parsed" | "needs_review" | "confirmed" | "failed" | "deleted";
export type OutboxStatus = "pending" | "sent" | "failed" | "cancelled";

export interface User {
  id: string;
  phoneE164: string;
  whatsappWaId?: string;
  displayName?: string;
  email?: string;
  locale: string;
  status: UserStatus;
  consentTermsAt?: string;
  consentPrivacyAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Household {
  id: string;
  ownerUserId: string;
  name: string;
  defaultCity?: string;
  defaultArea?: string;
  monthlyBudgetAmount: number;
  currency: Currency;
  budgetCycleDay: number;
  status: HouseholdStatus;
  /** Rich onboarding model (Household Financial Baseline Builder). Persisted in
   *  the `households.financial_baseline` jsonb column. `undefined` when no
   *  baseline has been captured (DB NULL round-trips to `undefined`). The MANAGED
   *  budget lives in `monthlyBudgetAmount`; raw income (if any) is only in
   *  `financialBaseline.budget.income`. */
  financialBaseline?: FinancialBaseline;
  createdAt: string;
  updatedAt: string;
}

/** Palette keys for member avatar colours. Matches tokens.css --m-* variables. */
export type MemberColorKey = "mom" | "dad" | "teen" | "kid" | "kid2";

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRole;
  permissions: Record<string, unknown>;
  joinedAt: string;
  status: "invited" | "active" | "removed";
  /** Monthly personal budget amount — tracked separately from the household budget. */
  personalBudgetMonthly?: number;
  /** Persisted avatar colour key. Assigned at member creation from Iteration 6 onward.
   *  Backfilled for pre-existing rows via migration 0018. */
  color?: MemberColorKey;
}

export type HouseholdExpenseApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface HouseholdExpenseApproval {
  id: string;
  householdId: string;
  submittedBy: string;
  amount: number;
  merchantNameRaw: string;
  category: Purchase["category"];
  submittedAt: string;
  status: HouseholdExpenseApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBudget {
  id: string;
  householdId: string;
  name: string;
  totalAmount: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** All-time sum of CONFIRMED purchases attributed to this project_budget_id.
   *  Populated only by listProjectBudgets / getProjectBudget; omitted on
   *  create/update returns. Derived (no DB column). Stripped for limited_member
   *  at the HTTP layer (aggregate project-transaction data is adult-only). */
  spent?: number;
}

/** Iteration 10 — per-category monthly spending cap.
 *  owner/admin-managed; one row per (household, category). The cap applies to
 *  the household's current budget-cycle window (no proration). */
export interface CategoryBudget {
  id: string;
  householdId: string;
  category: Purchase["category"];
  /** Absolute monthly limit in ILS. Always > 0. */
  monthlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  invitedBy: string;
  invitedPhone: string;
  invitedName?: string;
  role: HouseholdRole;
  personalBudgetMonthly?: number;
  expiresAt: string;
  consumedAt?: string;
  consumedBy?: string;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListItem {
  id: string;
  listId: string;
  householdId: string;
  createdByUserId?: string;
  rawText: string;
  normalizedName?: string;
  quantity?: number;
  unit?: string;
  status: "active" | "purchased" | "removed";
  source: "whatsapp_text" | "web" | "receipt_suggestion" | "recurring";
  notes?: string;
  /** Supermarket-route category. Always populated: new items are categorized at
   *  insert time; legacy pre-0017 rows are categorized via read-fallback in
   *  rowToShoppingListItem (computed, not persisted). */
  categoryId: ShoppingCategoryId;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  householdId: string;
  userId?: string;
  merchantNameRaw?: string;
  purchaseDate: string;
  totalAmount: number;
  currency: Currency;
  source: "manual_whatsapp" | "receipt_photo" | "web_manual" | "import_future";
  category: "supermarket" | "pharmacy_health" | "restaurants_cafes" | "fuel_transport" | "kids" | "entertainment" | "other";
  expenseType: "household" | "personal";
  projectBudgetId?: string;
  confidenceScore?: number;
  status: "draft" | "confirmed" | "needs_review" | "deleted" | "cancelled";
  dedupKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  householdId: string;
  purchaseId?: string;
  uploadedByUserId: string;
  originalImageUrl?: string;
  signedImageUrl?: string;
  imageRetentionUntil?: string;
  ocrText?: string;
  ocrProvider?: string;
  parserVersion?: string;
  parsedJson?: ParsedReceipt;
  confidenceScore?: number;
  status: ReceiptStatus;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptItem {
  id: string;
  receiptId: string;
  purchaseId?: string;
  rawLineText: string;
  rawProductName?: string;
  normalizedProductName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal: number;
  discountAmount?: number;
  confidenceScore: number;
  status: "parsed" | "corrected" | "ignored";
  createdAt: string;
  updatedAt: string;
}

export interface ParsedReceipt {
  merchantName: string;
  purchaseDate: string;
  totalAmount: number;
  items: Array<{
    rawLineText: string;
    rawProductName: string;
    normalizedProductName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    confidenceScore: number;
  }>;
}

export interface Subscription {
  id: string;
  householdId: string;
  provider: "mock" | "grow" | "payplus" | "tranzila" | "meshulam" | "stripe_future" | "manual";
  planCode: PlanCode;
  status: SubscriptionStatus;
  trialStartedAt?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Entitlement {
  id: string;
  householdId: string;
  featureCode: string;
  limitType: "boolean" | "monthly_count" | "total_count" | "fair_use";
  limitValue?: number;
  usedValue: number;
  periodStart?: string;
  periodEnd?: string;
}

export interface WhatsAppMessage {
  id: string;
  userId?: string;
  householdId?: string;
  whatsappMessageId: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "button" | "template" | "interactive" | "document" | "audio_future";
  rawPayload: Record<string, unknown>;
  normalizedText?: string;
  intent?: string;
  processingStatus: "received" | "processed" | "failed" | "ignored";
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  rawPayload: Record<string, unknown>;
  processedAt?: string;
  status: "received" | "processed" | "failed" | "duplicate";
  failureReason?: string;
  createdAt: string;
}

export interface OutboxMessage {
  id: string;
  channel: "whatsapp" | "notification" | "invoice";
  destination: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  providerMessageId?: string;
  status: OutboxStatus;
  retryCount: number;
  nextAttemptAt: string;
  sentAt?: string;
  failureReason?: string;
  // Provider delivery lifecycle (Meta `statuses[]` webhooks), distinct from the
  // queue `status` above. `status` flips to "sent" when Meta ACCEPTS the send;
  // these fields record what Meta later reports about actual delivery. All
  // optional — populated only after a status webhook is reconciled by wamid.
  deliveryStatus?: "sent" | "delivered" | "read" | "failed";
  deliveryErrorCode?: string;
  deliveryErrorTitle?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  deliveryUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin-safe projection of an outbox row, returned by GET /api/v1/admin/overview
 * (see the backend `toAdminOutbox`). It deliberately EXCLUDES the message
 * body/payload — an auth message body is a magic link containing a single-use
 * bearer token — and masks the recipient and provider id. Use this, never the
 * raw OutboxMessage, for admin surfaces.
 */
export interface AdminOutboxView {
  id: string;
  channel: OutboxMessage["channel"];
  destinationMasked: string;
  status: OutboxStatus;
  deliveryStatus?: "sent" | "delivered" | "read" | "failed";
  deliveryErrorCode?: string;
  deliveryErrorTitle?: string;
  kind?: string;
  providerMessageIdMasked?: string;
  idempotencyKey: string;
  retryCount: number;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  deliveryUpdatedAt?: string;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin-safe projection of a webhook event, returned by GET /api/v1/admin/overview
 * (see the backend `toAdminWebhookEvent`). It deliberately EXCLUDES `rawPayload`
 * — the raw inbound provider payload can contain the sender's full phone number,
 * profile name, raw message text, and (for auth/invite events) single-use bearer
 * tokens — and omits the raw `eventId` (a provider message id). The admin UI only
 * renders provider/eventType/status. Use this, never the raw WebhookEvent, for
 * admin surfaces.
 */
export interface AdminWebhookEventView {
  id: string;
  provider: string;
  eventType: string;
  status: WebhookEvent["status"];
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

/**
 * Admin-safe projection of a WhatsApp message mirror row, returned by
 * GET /api/v1/admin/overview (see the backend `toAdminMessage`). It deliberately
 * EXCLUDES `rawPayload` — the raw inbound provider payload carries the sender's
 * full phone number and profile name — and masks the provider message id.
 * `normalizedText` is retained for support visibility but link-token scrubbed
 * (an outbound auth message's text IS a magic link). Use this, never the raw
 * WhatsAppMessage, for admin surfaces.
 */
export interface AdminMessageView {
  id: string;
  userId?: string;
  householdId?: string;
  whatsappMessageIdMasked?: string;
  direction: WhatsAppMessage["direction"];
  messageType: WhatsAppMessage["messageType"];
  normalizedText?: string;
  intent?: string;
  processingStatus: WhatsAppMessage["processingStatus"];
  createdAt: string;
}

/**
 * Admin-safe household summary for GET /api/v1/admin/overview (see the backend
 * `toAdminHousehold`). It deliberately EXCLUDES the raw owner `User` — full
 * phone (`phoneE164`), `email`, and `whatsappWaId` must never reach the
 * overview; the owner appears only as a masked identity. The subscription is
 * reduced to plan/billing state. Use this, never the raw store record, for
 * admin surfaces.
 */
export interface AdminHouseholdView {
  household: {
    id: string;
    ownerUserId: string;
    name: string;
    status: HouseholdStatus;
    createdAt: string;
  };
  owner?: {
    id: string;
    displayName?: string;
    phoneMasked: string;
  };
  subscription?: {
    planCode: PlanCode;
    status: SubscriptionStatus;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
  };
  budget: BudgetCurrent;
}

/**
 * Admin-safe receipt summary for GET /api/v1/admin/overview (see the backend
 * `toAdminReceipt`). It deliberately EXCLUDES `ocrText` and the full
 * `parsedJson` body (raw receipt contents are household financial data) and the
 * image URL fields. Only the merchant name + total survive as a support-facing
 * summary; full receipt detail stays behind the reason-gated
 * /admin/receipts/:id/access flow.
 */
export interface AdminReceiptView {
  id: string;
  householdId: string;
  uploadedByUserId: string;
  purchaseId?: string;
  status: ReceiptStatus;
  merchantName?: string;
  totalAmount?: number;
  confidenceScore?: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin-safe audit entry for GET /api/v1/admin/overview (see the backend
 * `toAdminAuditOverview`). It deliberately EXCLUDES `ipAddress`, `userAgent`,
 * and the free-form `metadata` blob (which can embed phones, emails, links).
 * Only the typed accountability fields survive.
 */
export interface AdminAuditView {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  householdId?: string;
  adminSubject?: string;
  reason?: string;
  createdAt: string;
}

/**
 * Admin-safe provider-log entry for GET /api/v1/admin/overview (see the backend
 * `toAdminProviderLog`). The raw `metadata` blob is NOT exposed (it can carry
 * raw provider responses, media descriptors, and webhook fragments); only the
 * allowlisted delivery-reconciliation keys survive, and the correlation id
 * (often a provider message id / wamid) is masked.
 */
export interface AdminProviderLogView {
  id: string;
  provider: ProviderLog["provider"];
  direction: ProviderLog["direction"];
  eventType: string;
  status: ProviderLog["status"];
  correlationIdMasked?: string;
  failureReason?: string;
  /** Allowlisted operational keys only: deliveryStatus / errorCode / errorTitle. */
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Admin-safe analytics entry for GET /api/v1/admin/overview (see the backend
 * `toAdminAnalyticsEvent`). It deliberately EXCLUDES `properties` — event
 * properties carry user content (e.g. a shopping item's rawText).
 */
export interface AdminAnalyticsEventView {
  id: string;
  name: AnalyticsEventName;
  householdId?: string;
  userId?: string;
  createdAt: string;
}

/** Admin-safe entitlement row for GET /api/v1/admin/overview — explicit pick of the (non-PII) usage counters. */
export interface AdminEntitlementView {
  id: string;
  householdId: string;
  featureCode: string;
  limitType: Entitlement["limitType"];
  limitValue?: number;
  usedValue: number;
  periodStart?: string;
  periodEnd?: string;
}

/** Admin-safe support-note row for GET /api/v1/admin/overview — admin-authored content, explicit pick. */
export interface AdminSupportNoteView {
  id: string;
  householdId: string;
  adminSubject: string;
  body: string;
  createdAt: string;
}

// ── Admin V2 — Household Account 360 (read-only aggregate + audited writes) ───
// Every view DTO below is masked by default. Full phone is exposed ONLY via the
// dedicated audited reveal endpoint (AdminRevealResult) — never in a list/detail
// view, never in logs. WhatsApp message CONTENT is never surfaced anywhere here;
// the activity rollups carry timestamps/direction/counts only.

/** Raw subscription_events row (migration 0026; first writer = the manual-grant flow). */
export interface SubscriptionEvent {
  id: string;
  householdId: string;
  /** trial_started | activated | manual_grant | manual_grant_revoked | … */
  eventType: string;
  planCode?: string;
  fromStatus?: string;
  toStatus?: string;
  provider?: string;
  /** For manual grants: { reason, adminSubject, grantKind, correlationId, startsAt, endsAt }. */
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Search dimensions for the household console. */
export type AdminHouseholdSearchBy = "phone" | "owner" | "id" | "user_id" | "status";

/** Manual-entitlement grant kinds. NONE of these is ever "paid" — a grant is free
 *  access, labeled distinctly, never faking provider payment state. */
export type AdminGrantKind = "extend_trial" | "free_month" | "goodwill" | "internal_test";

/** One household row in search / list. Owner phone MASKED. */
export interface AdminHouseholdSearchRow {
  householdId: string;
  name: string;
  ownerDisplayName?: string;
  ownerPhoneMasked: string;
  status: HouseholdStatus;
  /** Resolved against the pricebook — NEVER the synthetic literal "trial" as a tier. */
  planLabel: string;
  effectiveBillingStatus: EffectiveBillingStatus;
  memberCount: number;
  /** Newest WA in/out timestamp for the household (content never read). */
  lastWaActivityAt?: string;
  integrityFlagCount: number;
}

/** A member in the 360 roster. Phone MASKED by default — reveal is separate + audited. */
export interface AdminHousehold360Member {
  memberId: string;
  userId: string;
  displayName?: string;
  phoneMasked: string;
  role: HouseholdRole;
  /** 'invited' | 'active' | 'removed' — removed/left members ARE included by design. */
  status: HouseholdMember["status"];
  isOwner: boolean;
  /** DISPLAY-ONLY: an adult_member granted permissions.all (a household co-manager).
   *  Derived from the existing permissions — NOT a new role, value, or authz rule. */
  isCoManager: boolean;
  joinedAt: string;
  /** WA + dashboard activity — TIMESTAMPS ONLY, never message content. */
  lastWaInboundAt?: string;
  lastWaOutboundAt?: string;
  dashboardLastSeenAt?: string;
  /** True when the user is still status='onboarding' (onboarding-stuck indicator). */
  onboardingStuck: boolean;
}

/** A pending / consumed / stale invite shown in the 360 (invited phone MASKED). */
export interface AdminHousehold360Invite {
  id: string;
  invitedPhoneMasked: string;
  invitedName?: string;
  role: HouseholdRole;
  expiresAt: string;
  consumedAt?: string;
  /** Derived: 'pending' | 'consumed' | 'expired'. */
  state: "pending" | "consumed" | "expired";
}

/** Audited reveal/grant timeline entry, masked-safe (no token, no raw value). */
export interface AdminSubscriptionEventView {
  id: string;
  eventType: string;
  reason?: string;
  adminSubject?: string;
  grantKind?: string;
  correlationId?: string;
  /** Set on the compensating revoke event → its target grant. */
  revokesCorrelationId?: string;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

/** Read-only billing/entitlement panel for a household. */
export interface AdminBillingView {
  /** Stored subscription status (forensic) — the headline is `effectiveStatus`. */
  rawStatus?: SubscriptionStatus;
  effectiveStatus: EffectiveBillingStatus;
  /** Resolved pricebook label, or "Trial (no pricebook plan)" for the synthetic `trial`. */
  planLabel: string;
  /** Raw stored plan code (forensic) — NEVER used as the display tier. */
  planCode?: PlanCode;
  provider?: Subscription["provider"];
  /** True when access is a manual grant (mock/manual provider granting active access). */
  isManualGrant: boolean;
  /** Real paid subscription — ALWAYS false for a mock/manual provider. */
  isPaid: boolean;
  trialEndsAt?: string;
  trialDaysRemaining?: number | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  /** Usage meters — labeled DISTINCT from grants; a grant is never inferred from these. */
  usageMeters: AdminEntitlementView[];
  /** subscription_events timeline (empty until the first manual grant). */
  events: AdminSubscriptionEventView[];
}

/** Per-household operational health. Only fields cleanly scopable to ONE household
 *  (outbox/webhook_events carry no household_id; whatsapp_messages does). */
export interface AdminHousehold360Ops {
  /** whatsapp_messages for this household with processingStatus='failed' (timestamps/status only). */
  failedWaMessageCount: number;
  /** Unconsumed invites past expiry. */
  staleInviteCount: number;
  /** Unconsumed invites still valid. */
  pendingInviteCount: number;
}

export interface AdminHousehold360Counts {
  members: number;
  activeMembers: number;
  purchases: number;
  receipts: number;
  shoppingItems: number;
}

/** The Household-360 aggregate. All PII masked; activity is timestamps-only. */
export interface AdminHousehold360 {
  household: {
    id: string;
    name: string;
    status: HouseholdStatus;
    ownerUserId: string;
    createdAt: string;
  };
  owner?: { id: string; displayName?: string; phoneMasked: string };
  members: AdminHousehold360Member[];
  invites: AdminHousehold360Invite[];
  billing: AdminBillingView;
  counts: AdminHousehold360Counts;
  ops: AdminHousehold360Ops;
  /** Integrity flag codes scoped to this household (e.g. "ownerless", "owner_col_mismatch"). */
  integrityFlags: string[];
}

/** Result of the audited full-phone reveal. The `value` is the UNMASKED phone and
 *  must NEVER be logged or persisted anywhere but the transient HTTP response. */
export interface AdminRevealResult {
  memberId: string;
  field: "phone";
  value: string;
}

/** Cross-household integrity report (bounded; lists are small flagged sets). */
export interface AdminIntegrityReport {
  ownerlessHouseholds: Array<{ householdId: string; name: string }>;
  ownerColumnMismatch: Array<{ householdId: string; name: string }>;
  multiHouseholdUsers: Array<{ userId: string; householdCount: number }>;
  duplicatePhones: Array<{ phoneMasked: string; userCount: number }>;
  pendingInviteToActiveMember: Array<{ inviteId: string; householdId: string }>;
  staleInvites: Array<{ inviteId: string; householdId: string; expiresAt: string }>;
  failedOutboxCount: number;
  failedWebhookCount: number;
  billingMismatchCount: number;
}

/** Bounded Overview counts block (no unbounded dumps, no funnels). */
export interface AdminOverviewCounts {
  householdsByStatus: Record<string, number>;
  activeTrials: number;
  integrityFlagCount: number;
  failedSendsCount: number;
  waActiveThisWeek: number;
  dashboardActiveThisWeek: number;
}

// ── C Minimal household category labels + aliases (migration 0027) ───────────
// Labels are personalization that roll up to one of the 7 system budget buckets;
// the bucket (Purchase["category"]) stays the source of truth for budget math.

export interface ExpenseCategoryLabel {
  id: string;
  householdId: string;
  /** Display label, e.g. "צדקה". */
  label: string;
  /** Folded form (case/whitespace/punct) — unique per household. */
  normalizedLabel: string;
  /** The 7-bucket parent this label rolls up to (budget math unchanged). */
  systemBucket: Purchase["category"];
  /** 'active' = live; 'proposed' = adult suggestion awaiting a manager; 'archived' = soft-off. */
  status: "active" | "proposed" | "archived";
  createdBy?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryAlias {
  id: string;
  householdId: string;
  /** The label this alias maps to. */
  categoryId: string;
  alias: string;
  /** Folded form — unique per household. */
  normalizedAlias: string;
  /** 'candidate' = proposed (NOT auto-applied); 'approved' = manager-approved (active). */
  status: "candidate" | "approved";
  createdBy?: string;
  approvedBy?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsEventName =
  | "onboarding_started"
  | "onboarding_completed"
  | "budget_set"
  | "manual_expense_added"
  | "shopping_item_added"
  | "receipt_uploaded"
  | "receipt_parsed"
  | "receipt_review_opened"
  | "receipt_confirmed"
  // WhatsApp Trust Loop (2026-06-18) receipt-proposal lifecycle instrumentation.
  | "receipt_proposal_created"
  | "receipt_proposal_approved"
  | "receipt_proposal_corrected"
  | "receipt_proposal_dismissed"
  | "receipt_proposal_expired"
  | "trial_limit_reached"
  | "checkout_started"
  | "subscription_activated";

export interface AnalyticsEvent {
  id: string;
  householdId?: string;
  userId?: string;
  name: AnalyticsEventName;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface ProviderLog {
  id: string;
  provider: "mock_whatsapp" | "meta_whatsapp" | "mock_ocr" | "google_vision" | "azure_read" | "azure_receipt" | "gemini_vision" | "gemini_nlp" | "mock_ai_parser" | "openai" | "openrouter" | "mock_payment" | "invoice";
  direction: "inbound" | "outbound" | "internal";
  eventType: string;
  status: "success" | "failed" | "duplicate" | "queued";
  correlationId?: string;
  metadata: Record<string, unknown>;
  failureReason?: string;
  createdAt: string;
}

export interface SupportNote {
  id: string;
  householdId: string;
  adminSubject: string;
  body: string;
  createdAt: string;
}

export interface BudgetCurrent {
  periodStart: string;
  periodEnd: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  daysRemaining: number;
  burnRateStatus: "on_track" | "slightly_high" | "high_risk" | "exceeded";
}

// ── Iteration 5 — Activity & spending feed ────────────────────────────────────

/** A single entry in the household activity feed (newest first). Composed from
 *  multiple sources: purchases, shopping items, pending approvals. Pure
 *  deterministic template strings — no LLM-generated copy. */
export interface ActivityEntry {
  /** ISO timestamp of the activity. Used for sort order and "X ago" rendering. */
  ts: string;
  kind: "expense" | "shopping" | "approval";
  /** User id of the actor (if known) — Frontend uses it for Avatar colour. */
  actorUserId?: string;
  /** Display name of the actor (resolved server-side from members). */
  actorName?: string;
  /** Short Hebrew sentence describing the action. Templated, not free text. */
  detailHe: string;
  /** Amount in ILS when applicable (expense / pending approval). */
  amount?: number;
  /** Emoji icon picked from a small fixed palette — never LLM-generated. */
  icon?: string;
  /** True when an admin/owner needs to act on this entry. */
  needsApproval?: boolean;
}

/** Per-category spend breakdown for a given period. */
export interface SpendingByCategoryEntry {
  /** Purchase.category — the same 7-bucket taxonomy used throughout the app. */
  category: Purchase["category"];
  /** Total ILS spent for the period (household-only, project-attributed excluded). */
  spent: number;
  /** Per-category monthly cap (Iteration 10). Populated from `category_budgets`
   *  when a cap is set for this category; omitted when no cap exists. */
  budget?: number;
}

/** Per-member spend breakdown for a given period. */
export interface SpendingByMemberEntry {
  userId: string;
  displayName: string;
  amount: number;
}

/** Per-weekday spend breakdown for a given period.
 *  weekday is 0=Sunday … 6=Saturday (Israeli week start). */
export interface SpendingByWeekdayEntry {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  labelHe: string;
  amount: number;
}

/** Iteration 7 — Insights / Weekly Wrapped.
 *  Deterministic, server-composed weekly recap. Hebrew copy is always rendered
 *  on the server (`headlineHe`); the Frontend never composes Hebrew strings.
 *  See `apps/api/src/insights.ts` for the composition source. */
export type InsightKind =
  | "total_spend"
  | "week_over_week"
  | "month_over_month"
  | "top_category"
  | "top_member"
  | "busiest_weekday"
  | "purchase_count"
  | "streak_days"
  | "empty_state";

/** Period selector for the spending-breakdown endpoints. `month` = the current
 *  budget cycle (the dashboard default); `week` = the current Israeli Sun–Sat
 *  week; `prevMonth` = the immediately-preceding budget cycle. */
export type SpendingPeriod = "week" | "month" | "prevMonth";

export interface WeeklyInsight {
  kind: InsightKind;
  /** Server-rendered Hebrew headline. Already preposition-correct. */
  headlineHe: string;
  /** Numeric value where applicable (₪ amount, count, day-count). */
  value?: number;
  /** Week-over-week comparison. `deltaPct` is intentionally optional and is
   *  omitted when the previous week's total is 0, so consumers never see
   *  Infinity, NaN, or a fabricated percentage. */
  comparison?: { previous: number; deltaAbs: number; deltaPct?: number };
  /** Set on `top_member` so the Frontend can render the Iteration 6 Avatar. */
  memberId?: string;
  /** Set on `top_category` (Purchase category id). */
  categoryId?: string;
  /** Set on `busiest_weekday` (0 = Sunday, Israeli week). */
  weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export interface WeeklyInsightsResponse {
  /** Inclusive lower bound. ISO UTC instant of Sunday 00:00 Asia/Jerusalem. */
  weekStartIso: string;
  /** EXCLUSIVE upper bound. ISO UTC instant of the next Sunday 00:00
   *  Asia/Jerusalem. Half-open interval `[weekStartIso, nextWeekStartIso)`
   *  to avoid millisecond/timezone edge bugs around Saturday 23:59:59. */
  nextWeekStartIso: string;
  insights: WeeklyInsight[];
}

/** Monthly (budget-cycle) recap. Same deterministic server-composed shape as the
 *  weekly Wrapped, plus a per-week-of-cycle spend trend (`weeksTrend`). Hebrew is
 *  always server-rendered (`WeeklyInsight.headlineHe`). */
export interface MonthlyInsightsResponse {
  /** Inclusive YYYY-MM-DD lower bound of the budget cycle. */
  periodStart: string;
  /** Inclusive YYYY-MM-DD upper bound of the budget cycle. */
  periodEnd: string;
  insights: WeeklyInsight[];
  /** Per-week-of-cycle spend buckets (שבוע 1..N — a cycle can span 4 or 5
   *  weeks depending on cycleDay / month length). */
  weeksTrend: { weekIndex: number; weekLabelHe: string; amount: number }[];
}

/** Iteration 8 — Rich ChildView with Wishlist (deterministic).
 *
 *  A per-user private wishlist scoped to a single household. Privacy is
 *  enforced at three layers (HTTP router, store query, NLP handler):
 *    - limited_member sees ONLY their own items
 *    - adult_member  sees ONLY their own items (they are NOT parents here)
 *    - owner/admin   see all `limited_member`-owned items in their household
 *      via /api/v1/households/:id/wishlist; their own items are visible only
 *      through /wishlist/me, never on the children surface.
 */
export type WishlistItemStatus = "open" | "fulfilled" | "removed";
export type WishlistItemPriority = "low" | "normal" | "high";

export interface WishlistItem {
  id: string;
  householdId: string;
  /** The user who owns the item (any role with a household). */
  ownerUserId: string;
  /** Plain Hebrew title, 1–120 chars. */
  title: string;
  /** Optional free-text note from the owner. */
  note?: string;
  /** Optional NIS price estimate. Always > 0 when present. */
  priceEst?: number;
  priority: WishlistItemPriority;
  status: WishlistItemStatus;
  /** Set when status transitions to `fulfilled` (owner/admin only). */
  fulfilledByUserId?: string;
  /** ISO timestamp the item became `fulfilled`. */
  fulfilledAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Iteration 9 — Member Activity Heatmap (owner/admin/adult_member only).
 *
 *  Per-member, per-day confirmed household purchase counts for the last N days.
 *  Personal expenses and project-attributed expenses are excluded (consistent
 *  with the household-budget invariant). Days are zero-filled so the Frontend
 *  can render a complete grid without sparse-data logic.
 */
export interface MemberHeatmapRow {
  userId: string;
  displayName: string;
  /** Persisted Iteration 6 avatar colour. Null when the member has no colour
   *  assigned yet (rare — onboarding always assigns one). */
  color: MemberColorKey | null;
  /** Zero-filled list ordered chronologically, startDate → endDate inclusive.
   *  `date` is always "YYYY-MM-DD" in Asia/Jerusalem local time. */
  days: Array<{ date: string; count: number }>;
}

export interface MemberActivityHeatmapResponse {
  /** ISO date string "YYYY-MM-DD" of the first day in the range (inclusive). */
  startDate: string;
  /** ISO date string "YYYY-MM-DD" of the last day in the range (inclusive). */
  endDate: string;
  /** Number of days covered (= endDate − startDate + 1, clamped 1–31). */
  days: number;
  /** One row per member who belongs to the household; ordered by displayName. */
  rows: MemberHeatmapRow[];
}

export interface AuthSessionPayload {
  accessToken?: string;
  user: User;
  csrfToken: string;
  hasHousehold: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
