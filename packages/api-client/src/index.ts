import type {
  ActivityEntry,
  AuthSessionPayload,
  BudgetCurrent,
  CategoryBudget,
  Household,
  HouseholdExpenseApproval,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
  MemberActivityHeatmapResponse,
  AdminAnalyticsEventView,
  AdminAuditView,
  AdminEntitlementView,
  AdminHouseholdView,
  AdminMessageView,
  AdminOutboxView,
  AdminProviderLogView,
  AdminReceiptView,
  AdminSupportNoteView,
  AdminWebhookEventView,
  AdminHouseholdSearchRow,
  AdminHousehold360,
  AdminBillingView,
  AdminIntegrityReport,
  AdminOverviewCounts,
  AdminHouseholdSearchBy,
  AdminGrantKind,
  ProjectBudget,
  Purchase,
  Receipt,
  ReceiptItem,
  ShoppingList,
  ShoppingListItem,
  SpendingByCategoryEntry,
  SpendingByMemberEntry,
  SpendingByWeekdayEntry,
  Subscription,
  User,
  WeeklyInsightsResponse,
  WishlistItem,
  WishlistItemPriority,
  OnboardingBaselineRequest,
  BillingPlan,
  BillingStatusDto,
  Entitlement,
  PaidPlanCode
} from "@shopping-assistant/shared-types";

export interface ApiClientOptions {
  baseUrl: string;
  getCsrfToken?: () => string | undefined;
  setCsrfToken?: (token: string) => void;
}

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

// ── Admin User-Management MVP DTOs (masked; no token hashes) ────────────────
export type AdminUserSearchBy = "phone" | "name" | "email" | "id";

export interface AdminUserSummary {
  id: string;
  displayName?: string;
  phoneMasked: string;
  emailMasked?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMembership {
  householdId: string;
  householdName?: string;
  role: string;
  memberStatus: string;
  isOwner: boolean;
}

export interface AdminWebSessionView {
  id: string;
  createdAt: string;
  lastSeenAt?: string;
  expiresAt: string;
  revokedAt?: string;
  active: boolean;
  ipMasked?: string;
  userAgent?: string;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  createdAt: string;
  adminSubject?: string;
  reason?: string;
  metadata: Record<string, unknown>;
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  memberships: AdminMembership[];
  activeSessionCount: number;
  activeMagicLinkCount: number;
  isActive: boolean;
}

export interface AdminQaResetResult {
  reset: boolean;
  cleared: { sessions: number; magicLinks: number; membershipsRemoved: number; pendingInvitesCancelled: number };
  preserved: { userId: string; ownedHouseholdIds: string[] };
}

export function createApiClient(options: ApiClientOptions) {
  const rawRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const method = (init.method ?? "GET").toUpperCase();
    const csrfToken = options.getCsrfToken?.();
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrfToken);
    }
    const response = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include"
    });
    const text = await response.text();
    // Parse defensively: a non-JSON body (an HTML edge/error page, a proxy 5xx, a Cloudflare
    // interstitial) must NOT throw a status-less SyntaxError here — that was surfacing via
    // toErrorMessage as a misleading "network/CORS" failure that HID the real HTTP status
    // (e.g. a 401/403 re-auth, or a 5xx). On a non-ok response we always carry response.status.
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    if (!response.ok) {
      throw new ApiClientError(data?.error?.code ?? "api.error", data?.error?.message ?? `Request failed with status ${response.status}`, response.status, data?.error?.details);
    }
    if (data?.csrfToken && typeof data.csrfToken === "string") {
      options.setCsrfToken?.(data.csrfToken);
    }
    return data as T;
  };

  // CSRF self-heal (2026-06-12 invite-403 incident): the session cookie outlives
  // localStorage.csrfToken, so a mutation can fail `auth.csrf_invalid` while the user
  // is still logged in. On that exact failure, refresh the session once via GET /me
  // (the server rotates and returns a fresh csrfToken, stored by setCsrfToken above)
  // and retry the original request exactly ONCE — rawRequest re-reads getCsrfToken()
  // at send time, so the retry carries the fresh token. If the refresh or the retry
  // fails, the error propagates: no loops, and real authorization failures are never
  // masked.
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    try {
      return await rawRequest<T>(path, init);
    } catch (error) {
      const method = (init.method ?? "GET").toUpperCase();
      const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (!(error instanceof ApiClientError) || error.code !== "auth.csrf_invalid" || !isMutation) throw error;
      try {
        await rawRequest("/api/v1/me");
      } catch {
        throw error;
      }
      return rawRequest<T>(path, init);
    }
  };

  return {
    request,
    health: () => request<{ ok: true }>("/health"),
    requestMagicLink: (phone: string, next?: string) =>
      request<{ status: "sent" }>("/api/v1/auth/magic-link/request", {
        method: "POST",
        body: JSON.stringify({ phone, channel: "whatsapp", purpose: "login", ...(next ? { next } : {}) })
      }),
    // POST (not GET): consuming a one-time login token is a state change and must only
    // happen on an explicit user action — link-preview crawlers that render the consume
    // page (2026-06-12: facebookexternalhit) must never trigger it.
    consumeMagicLink: (token: string) =>
      request<AuthSessionPayload>("/api/v1/auth/magic-link/consume", {
        method: "POST",
        body: JSON.stringify({ token })
      }),
    // Self-service logout: the backend revokes the caller's own session and clears the
    // HttpOnly cookie. POST (state change, CSRF-protected). Returns 200 on success and
    // also when the session was already gone (idempotent). The caller should still drop
    // its local csrf afterwards (clearClientSession) and route to /login.
    logout: () => request<{ ok: true }>("/api/v1/auth/logout", { method: "POST" }),
    me: () => request<{ user: User; household?: Household; membership?: HouseholdMember; csrfToken: string }>("/api/v1/me"),
    completeOnboarding: (body: {
      displayName: string;
      householdName: string;
      monthlyBudgetAmount: number;
      defaultCity: string;
      budgetCycleDay?: number;
      acceptTerms: true;
      acceptPrivacy: true;
      // Optional rich onboarding baseline. `monthlyBudgetAmount` is the MANAGED
      // budget; if a baseline is sent its budget.managedMonthlyBudget MUST equal it.
      baseline?: OnboardingBaselineRequest;
    }) =>
      request<{ user: User; household: Household }>("/api/v1/onboarding/complete", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    currentHousehold: () => request<{ household: Household; subscription?: Subscription }>("/api/v1/households/current"),
    updateHouseholdSettings: (householdId: string, body: { budgetCycleDay?: number; monthlyBudgetAmount?: number; defaultCity?: string }) =>
      request<{ household: Household }>(`/api/v1/households/${householdId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    myHouseholdRequests: (householdId: string) =>
      request<{ requests: HouseholdExpenseApproval[] }>(`/api/v1/households/${householdId}/my-requests`),
    budgetCurrent: (householdId: string) => request<BudgetCurrent & { mySpentAmount: number; myPersonalSpent: number }>(`/api/v1/households/${householdId}/budget/current`),
    shoppingList: (householdId: string) => request<{ list: ShoppingList; items: ShoppingListItem[] }>(`/api/v1/households/${householdId}/shopping-list`),
    addShoppingItem: (householdId: string, rawText: string) =>
      request<{ item: ShoppingListItem }>(`/api/v1/households/${householdId}/shopping-list/items`, {
        method: "POST",
        body: JSON.stringify({ rawText })
      }),
    patchShoppingItem: (itemId: string, body: Partial<Pick<ShoppingListItem, "rawText" | "quantity" | "unit" | "status">>) =>
      request<{ item: ShoppingListItem }>(`/api/v1/shopping-list/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    sendShoppingListToWhatsapp: (householdId: string) =>
      request<{ status: string; itemCount: number }>(`/api/v1/households/${householdId}/shopping-list/send-to-whatsapp`, {
        method: "POST"
      }),
    addManualPurchase: (householdId: string, body: { amount: number; merchantNameRaw?: string; category?: string }) =>
      request<{ purchase: Purchase; budget: BudgetCurrent }>(`/api/v1/households/${householdId}/purchases/manual`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    receipts: () => request<{ receipts: Receipt[] }>("/api/v1/receipts"),
    uploadReceiptImage: (householdId: string, body: { imageBase64: string; filename?: string; contentType?: string }) =>
      request<{ receiptId: string; receipt: Receipt }>(`/api/v1/households/${householdId}/receipts/upload`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    receiptCorrection: (receiptId: string) => request<{ receipt: Receipt; items: ReceiptItem[]; signedImageUrl: string }>(`/api/v1/receipts/${receiptId}/correction`),
    updateReceiptCorrection: (receiptId: string, body: { merchantName: string; purchaseDate: string; totalAmount: number; items: Array<Record<string, unknown>> }) =>
      request<{ receipt: Receipt; items: ReceiptItem[] }>(`/api/v1/receipts/${receiptId}/correction`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    confirmReceipt: (receiptId: string) =>
      request<{ receipt: Receipt; purchase: Purchase; budget: BudgetCurrent }>(`/api/v1/receipts/${receiptId}/confirm`, {
        method: "POST"
      }),
    // ── Billing (composition-tier model; pricebook is server-authoritative) ──
    // The catalog of purchasable plans + the 20-day trial length. Render prices as
    // ₪ = priceAgorot / 100. The server owns this list; never hardcode prices in the UI.
    billingPlans: () =>
      request<{ plans: BillingPlan[]; currency: "ILS"; trialDays: number }>("/api/v1/billing/plans"),
    // Household billing status: raw subscription row, entitlements, and the computed
    // BillingStatusDto (effectiveStatus / trialDaysRemaining / requiredTier / upgradeRequired).
    billingStatus: () =>
      request<{ subscription?: Subscription; entitlements: Entitlement[]; billing: BillingStatusDto }>(
        "/api/v1/billing/subscription"
      ),
    // planCode is tightened to the 6 canonical paid codes — `trial`/legacy are not purchasable.
    checkoutSession: (householdId: string, planCode: PaidPlanCode) =>
      request<{ checkoutUrl: string; checkoutSessionId: string }>(`/api/v1/billing/checkout-session`, {
        method: "POST",
        body: JSON.stringify({ householdId, planCode })
      }),
    changePlan: (householdId: string, planCode: PaidPlanCode) =>
      request<{ subscription: Subscription }>(`/api/v1/billing/change-plan`, {
        method: "POST",
        body: JSON.stringify({ householdId, planCode })
      }),
    cancelSubscription: (householdId: string, immediate?: boolean) =>
      request<{ subscription: Subscription }>(`/api/v1/billing/cancel`, {
        method: "POST",
        body: JSON.stringify({ householdId, ...(immediate !== undefined ? { immediate } : {}) })
      }),
    adminLogin: (token: string) =>
      request<{ csrfToken: string; adminSubject: string }>("/api/v1/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ token })
      }),
    /** Verified admin identity from Cloudflare Access (or the dev-session subject in local dev). */
    adminAuthMe: () => request<{ adminEmail: string; via: string }>("/api/v1/admin/auth/me"),
    adminOverview: () =>
      request<{
        households: AdminHouseholdView[];
        receipts: AdminReceiptView[];
        messages: AdminMessageView[];
        outbox: AdminOutboxView[];
        webhookEvents: AdminWebhookEventView[];
        entitlements: AdminEntitlementView[];
        analyticsEvents: AdminAnalyticsEventView[];
        providerLogs: AdminProviderLogView[];
        supportNotes: AdminSupportNoteView[];
        auditLogs: AdminAuditView[];
      }>("/api/v1/admin/overview"),
    addSupportNote: (householdId: string, body: string) =>
      request<{ note: unknown }>("/api/v1/admin/support-notes", {
        method: "POST",
        body: JSON.stringify({ householdId, body })
      }),
    // ── Admin User-Management MVP ──────────────────────────────────────────
    adminSearchUsers: (by: AdminUserSearchBy, q: string, limit = 20) =>
      request<{ users: AdminUserSummary[] }>(`/api/v1/admin/users/search?by=${by}&q=${encodeURIComponent(q)}&limit=${limit}`),
    adminGetUser: (userId: string) =>
      request<AdminUserDetail>(`/api/v1/admin/users/${encodeURIComponent(userId)}`),
    adminUserSessions: (userId: string) =>
      request<{ sessions: AdminWebSessionView[] }>(`/api/v1/admin/users/${encodeURIComponent(userId)}/sessions`),
    adminUserAudit: (userId: string, limit = 50) =>
      request<{ entries: AdminAuditEntry[] }>(`/api/v1/admin/users/${encodeURIComponent(userId)}/audit?limit=${limit}`),
    adminRevokeSession: (userId: string, sessionId: string, reason: string) =>
      request<{ revoked: boolean; session: AdminWebSessionView }>(
        `/api/v1/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}/revoke`,
        { method: "POST", body: JSON.stringify({ reason }) }
      ),
    adminRevokeAllSessions: (userId: string, reason: string) =>
      request<{ revoked: boolean; revokedCount: number }>(
        `/api/v1/admin/users/${encodeURIComponent(userId)}/sessions/revoke-all`,
        { method: "POST", body: JSON.stringify({ reason }) }
      ),
    adminQaResetUser: (userId: string, reason: string, confirmToken?: string) =>
      request<AdminQaResetResult>(`/api/v1/admin/users/${encodeURIComponent(userId)}/qa-reset`, {
        method: "POST",
        body: JSON.stringify({ reason, ...(confirmToken ? { confirmToken } : {}) })
      }),
    adminDeactivateUser: (userId: string, reason: string) =>
      request<{ user: AdminUserSummary; revokedSessions: number }>(`/api/v1/admin/users/${encodeURIComponent(userId)}/deactivate`, {
        method: "POST",
        body: JSON.stringify({ reason })
      }),
    adminReactivateUser: (userId: string, reason?: string) =>
      request<{ user: AdminUserSummary }>(`/api/v1/admin/users/${encodeURIComponent(userId)}/reactivate`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {})
      }),
    // ── Admin V2 — Household 360 ───────────────────────────────────────────
    // ── Household-360 calls use the /h360/* alias, NOT /api/v1/admin/households/* ──────────
    // Cloudflare Access 302s the literal /api/v1/admin/households* path at the admin.pingtally.com
    // edge (proven: bare-path siblings reach Vercel 200, /households/search never reaches Vercel
    // or the backend). The same-origin BFF maps /h360/* back to the real backend /households/*
    // path server-side (apps/admin/src/lib/adminAlias.ts). Browser paths carry no "households"/
    // "search" token, so the edge does not challenge them. Auth/JWT forwarding is unchanged.
    adminSearchHouseholds: (by: AdminHouseholdSearchBy, q: string, limit = 20) =>
      request<{ households: AdminHouseholdSearchRow[] }>("/api/v1/admin/h360/find", {
        method: "POST",
        body: JSON.stringify({ by, q, limit })
      }),
    adminGetHousehold: (householdId: string) =>
      request<AdminHousehold360>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}`),
    adminHouseholdBilling: (householdId: string) =>
      request<AdminBillingView>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/billing`),
    adminHouseholdAudit: (householdId: string) =>
      // No query string: the backend defaults limit=50 (identical to the prior default). The 360
      // loads this eagerly, so keeping it bare-path avoids any query-string edge sensitivity.
      request<{ audit: AdminAuditEntry[] }>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/audit`),
    adminHouseholdNotes: (householdId: string) =>
      request<{ notes: AdminSupportNoteView[] }>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/notes`),
    adminIntegrity: () => request<AdminIntegrityReport>("/api/v1/admin/integrity"),
    adminOverviewCounts: () => request<AdminOverviewCounts>("/api/v1/admin/overview/counts"),
    /** Audited FULL-phone reveal (reason recorded before the value returns; value never logged). */
    adminRevealPhone: (householdId: string, memberId: string, reason: string) =>
      request<{ memberId: string; field: "phone"; value: string }>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/reveal`, {
        method: "POST",
        body: JSON.stringify({ field: "phone", memberId, reason })
      }),
    adminGrant: (householdId: string, kind: AdminGrantKind, reason: string, endsAt?: string) =>
      request<{ correlationId: string; billing: AdminBillingView }>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/grant`, {
        method: "POST",
        body: JSON.stringify({ kind, reason, ...(endsAt ? { endsAt } : {}) })
      }),
    adminRevokeGrant: (householdId: string, correlationId: string, reason: string) =>
      request<{ correlationId: string; billing: AdminBillingView }>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/grant/${encodeURIComponent(correlationId)}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason })
      }),
    adminAddHouseholdNote: (householdId: string, body: string) =>
      request<{ note: unknown }>("/api/v1/admin/support-notes", {
        method: "POST",
        body: JSON.stringify({ householdId, body })
      }),
    adminRepairOwner: (householdId: string, memberId: string, reason: string) =>
      request<{ ok: true; memberId: string; role: string }>(`/api/v1/admin/h360/${encodeURIComponent(householdId)}/repair-owner`, {
        method: "POST",
        body: JSON.stringify({ memberId, reason })
      }),
    listMembers: (householdId: string) =>
      request<{ members: Array<HouseholdMember & { displayName?: string; phoneE164?: string }> }>(`/api/v1/households/${householdId}/members`),
    inviteMember: (householdId: string, body: { phone: string; displayName?: string; role?: string; personalBudgetMonthly?: number | null }) =>
      request<{ invite: HouseholdInvite; joinLink: string }>(`/api/v1/households/${householdId}/members/invite`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    updateMember: (householdId: string, memberId: string, body: { role?: HouseholdRole; personalBudgetMonthly?: number | null; color?: string; permissions?: { all: boolean } }) =>
      request<{ member: HouseholdMember }>(`/api/v1/households/${householdId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    removeMember: (householdId: string, memberId: string) =>
      request<{ ok: true }>(`/api/v1/households/${householdId}/members/${memberId}`, { method: "DELETE" }),
    listProjectBudgets: (householdId: string) =>
      request<{ budgets: ProjectBudget[] }>(`/api/v1/households/${householdId}/project-budgets`),
    createProjectBudget: (householdId: string, body: { name: string; totalAmount: number; startDate?: string; endDate?: string }) =>
      request<{ budget: ProjectBudget }>(`/api/v1/households/${householdId}/project-budgets`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    updateProjectBudget: (householdId: string, budgetId: string, body: { name?: string; totalAmount?: number; startDate?: string | null; endDate?: string | null; isActive?: boolean }) =>
      request<{ budget: ProjectBudget }>(`/api/v1/households/${householdId}/project-budgets/${budgetId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    deleteProjectBudget: (householdId: string, budgetId: string) =>
      request<{ ok: true }>(`/api/v1/households/${householdId}/project-budgets/${budgetId}`, { method: "DELETE" }),
    getProjectBudgetDetail: (householdId: string, budgetId: string) =>
      request<{ budget: ProjectBudget; purchases: Purchase[]; spent: number }>(`/api/v1/households/${householdId}/project-budgets/${budgetId}/purchases`),
    listHouseholdPurchasesForPeriod: (householdId: string) =>
      request<{ purchases: Purchase[]; periodStart: string; periodEnd: string }>(`/api/v1/households/${householdId}/purchases/period`),
    // ── Iteration 5 — Activity & spending ──────────────────────────────────
    householdActivity: (householdId: string, limit = 50) =>
      request<{ entries: ActivityEntry[] }>(`/api/v1/households/${householdId}/activity?limit=${limit}`),
    spendingByCategory: (householdId: string) =>
      request<{ entries: SpendingByCategoryEntry[]; periodStart: string; periodEnd: string }>(`/api/v1/households/${householdId}/spending/by-category?period=current`),
    spendingByMember: (householdId: string) =>
      request<{ entries: SpendingByMemberEntry[]; periodStart: string; periodEnd: string }>(`/api/v1/households/${householdId}/spending/by-member?period=current`),
    spendingByWeekday: (householdId: string) =>
      request<{ entries: SpendingByWeekdayEntry[]; periodStart: string; periodEnd: string }>(`/api/v1/households/${householdId}/spending/by-weekday?period=current`),
    // ── Iteration 7 — Insights / Weekly Wrapped ───────────────────────────
    weeklyInsights: (householdId: string, week: "current" | "last" = "current") =>
      request<WeeklyInsightsResponse>(`/api/v1/households/${householdId}/insights/weekly?week=${week}`),
    // ── Iteration 10 — Per-category budget caps ───────────────────────────
    categoryBudgets: (householdId: string) =>
      request<{ budgets: CategoryBudget[] }>(`/api/v1/households/${householdId}/category-budgets`),
    setCategoryBudget: (householdId: string, category: string, monthlyLimit: number) =>
      request<{ budget: CategoryBudget }>(`/api/v1/households/${householdId}/category-budgets/${category}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyLimit })
      }),
    removeCategoryBudget: (householdId: string, category: string) =>
      request<{ ok: true }>(`/api/v1/households/${householdId}/category-budgets/${category}`, { method: "DELETE" }),
    // ── Iteration 9 — Member Activity Heatmap ─────────────────────────────
    memberActivityHeatmap: (householdId: string, days = 14) =>
      request<MemberActivityHeatmapResponse>(`/api/v1/households/${householdId}/activity/heatmap?days=${days}`),
    // ── Iteration 8 — Wishlist ─────────────────────────────────────────────
    createWishlistItem: (body: { title: string; note?: string; priceEst?: number; priority?: WishlistItemPriority }) =>
      request<{ item: WishlistItem }>("/api/v1/wishlist", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    myWishlist: () => request<{ items: WishlistItem[] }>("/api/v1/wishlist/me"),
    householdWishlist: (householdId: string) =>
      request<{ items: WishlistItem[] }>(`/api/v1/households/${householdId}/wishlist`),
    updateWishlistItem: (
      itemId: string,
      body: { title?: string; note?: string | null; priceEst?: number | null; priority?: WishlistItemPriority; status?: "open" | "fulfilled" | "removed" }
    ) =>
      request<{ item: WishlistItem }>(`/api/v1/wishlist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    deleteWishlistItem: (itemId: string) =>
      request<{ item: WishlistItem }>(`/api/v1/wishlist/${itemId}`, { method: "DELETE" }),
    lookupInvite: (token: string) =>
      request<{ invite: HouseholdInvite; household: Household | undefined }>(`/api/v1/households/join?token=${encodeURIComponent(token)}`),
    joinHousehold: (inviteToken: string, displayName?: string) =>
      request<{ member: HouseholdMember; household: Household | undefined }>("/api/v1/households/join", {
        method: "POST",
        body: JSON.stringify({ inviteToken, ...(displayName ? { displayName } : {}) })
      }),
    // Cold-recipient join (no session): the single-use invite token authenticates
    // the INVITED phone's user directly — the server consumes the invite, opens a
    // session (Set-Cookie), and returns a csrfToken (stored via setCsrfToken above).
    joinHouseholdDirect: (inviteToken: string, displayName?: string) =>
      request<{ member: HouseholdMember; household: Household | undefined; user: User; csrfToken: string }>("/api/v1/households/join/direct", {
        method: "POST",
        body: JSON.stringify({ inviteToken, ...(displayName ? { displayName } : {}) })
      })
  };
}
