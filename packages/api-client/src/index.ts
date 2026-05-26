import type {
  ActivityEntry,
  AuthSessionPayload,
  BudgetCurrent,
  Household,
  HouseholdExpenseApproval,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
  OutboxMessage,
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
  WebhookEvent,
  WhatsAppMessage
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

export function createApiClient(options: ApiClientOptions) {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
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
    const data = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      throw new ApiClientError(data?.error?.code ?? "api.error", data?.error?.message ?? "API request failed", response.status, data?.error?.details);
    }
    if (data?.csrfToken && typeof data.csrfToken === "string") {
      options.setCsrfToken?.(data.csrfToken);
    }
    return data as T;
  };

  return {
    request,
    health: () => request<{ ok: true }>("/health"),
    requestMagicLink: (phone: string, next?: string) =>
      request<{ status: "sent" }>("/api/v1/auth/magic-link/request", {
        method: "POST",
        body: JSON.stringify({ phone, channel: "whatsapp", purpose: "login", ...(next ? { next } : {}) })
      }),
    consumeMagicLink: (token: string) => request<AuthSessionPayload>(`/api/v1/auth/magic-link/consume?token=${encodeURIComponent(token)}`),
    me: () => request<{ user: User; household?: Household; membership?: HouseholdMember; csrfToken: string }>("/api/v1/me"),
    completeOnboarding: (body: {
      displayName: string;
      householdName: string;
      monthlyBudgetAmount: number;
      defaultCity: string;
      budgetCycleDay?: number;
      acceptTerms: true;
      acceptPrivacy: true;
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
    checkoutSession: (householdId: string, planCode: string) =>
      request<{ checkoutUrl: string; checkoutSessionId: string }>(`/api/v1/billing/checkout-session`, {
        method: "POST",
        body: JSON.stringify({ householdId, planCode })
      }),
    subscription: () => request<{ subscription?: Subscription }>("/api/v1/billing/subscription"),
    adminLogin: (token: string) =>
      request<{ csrfToken: string; adminSubject: string }>("/api/v1/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ token })
      }),
    adminOverview: () =>
      request<{
        households: unknown[];
        receipts: Receipt[];
        messages: WhatsAppMessage[];
        outbox: OutboxMessage[];
        webhookEvents: WebhookEvent[];
        entitlements: unknown[];
        analyticsEvents: unknown[];
        providerLogs: unknown[];
        supportNotes: unknown[];
        auditLogs: unknown[];
      }>("/api/v1/admin/overview"),
    addSupportNote: (householdId: string, body: string) =>
      request<{ note: unknown }>("/api/v1/admin/support-notes", {
        method: "POST",
        body: JSON.stringify({ householdId, body })
      }),
    listMembers: (householdId: string) =>
      request<{ members: Array<HouseholdMember & { displayName?: string; phoneE164?: string }> }>(`/api/v1/households/${householdId}/members`),
    inviteMember: (householdId: string, body: { phone: string; displayName?: string; role?: string; personalBudgetMonthly?: number | null }) =>
      request<{ invite: HouseholdInvite; joinLink: string }>(`/api/v1/households/${householdId}/members/invite`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    updateMember: (householdId: string, memberId: string, body: { role?: HouseholdRole; personalBudgetMonthly?: number | null }) =>
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
    lookupInvite: (token: string) =>
      request<{ invite: HouseholdInvite; household: Household | undefined }>(`/api/v1/households/join?token=${encodeURIComponent(token)}`),
    joinHousehold: (inviteToken: string, displayName?: string) =>
      request<{ member: HouseholdMember; household: Household | undefined }>("/api/v1/households/join", {
        method: "POST",
        body: JSON.stringify({ inviteToken, ...(displayName ? { displayName } : {}) })
      })
  };
}
