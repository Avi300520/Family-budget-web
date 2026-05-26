export * from "./shoppingCategories";

import type { ShoppingCategoryId } from "./shoppingCategories";

export type Currency = "ILS";
export type UserStatus = "onboarding" | "active" | "blocked" | "deleted";
export type HouseholdStatus = "trial" | "active" | "suspended" | "cancelled" | "deleted";
export type HouseholdRole = "owner" | "admin" | "adult_member" | "limited_member";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired" | "paused";
export type PlanCode = "trial" | "plus_monthly" | "plus_annual" | "family_pro_monthly" | "family_pro_annual";
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
  createdAt: string;
  updatedAt: string;
}

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
  /** Optional per-category budget cap. Not used yet — reserved for Iteration 6+. */
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
