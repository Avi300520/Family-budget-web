// Preview-only VISUAL demo data for the admin console.
//
// SAFETY — this can NEVER render in production:
//  • `isPreviewHost()` is an ALLOWLIST of non-production hosts (*.vercel.app /
//    localhost). The production admin host `admin.pingtally.com` (behind Cloudflare
//    Access) is never in the list, so demo mode cannot activate there.
//  • Demo mode only ever activates when a real admin API call FAILS with an
//    auth/transport error (i.e. the Vercel preview has no Access). On the
//    production host the failure path shows the real re-auth notice, never demo data.
//  • The fixtures are obviously fake (Demo Household / Demo Owner / masked +972-50-***-…),
//    contain no real PII, and ship as inert constants — they're only rendered behind
//    the gate above.
//  • Demo mode disables every write action, so nothing can be mutated.
//
// Types are derived from the api-client return types (the same convention the pages
// use) so the fixtures stay structurally in lock-step with the real DTO contract.
import { api } from "./api";

/** True only on known non-production preview/dev hosts. NEVER true on admin.pingtally.com. */
export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.endsWith(".vercel.app") || h === "localhost" || h === "127.0.0.1";
}

export const DEMO_BANNER =
  "Preview layout only — demo data is fake. Authenticated production data is only available on admin.pingtally.com after admin sign-in.";

export const DEMO_HOUSEHOLD_ID = "demo-1";

type Counts = Awaited<ReturnType<typeof api.adminOverviewCounts>>;
type Integrity = Awaited<ReturnType<typeof api.adminIntegrity>>;
type SearchRow = Awaited<ReturnType<typeof api.adminSearchHouseholds>>["households"][number];
type Household360 = Awaited<ReturnType<typeof api.adminGetHousehold>>;
type AuditEntry = Awaited<ReturnType<typeof api.adminHouseholdAudit>>["audit"][number];
type SupportNote = Awaited<ReturnType<typeof api.adminHouseholdNotes>>["notes"][number];
type Overview = Awaited<ReturnType<typeof api.adminOverview>>;

export const demoCounts: Counts = {
  householdsByStatus: { trial: 6, active: 2 },
  activeTrials: 5,
  integrityFlagCount: 3,
  failedSendsCount: 2,
  waActiveThisWeek: 9,
  dashboardActiveThisWeek: 7
};

export const demoIntegrity: Integrity = {
  ownerlessHouseholds: [{ householdId: "demo-ownerless", name: "Demo Ownerless HH" }],
  ownerColumnMismatch: [],
  multiHouseholdUsers: [],
  duplicatePhones: [],
  pendingInviteToActiveMember: [],
  staleInvites: [{ inviteId: "demo-inv-stale", householdId: DEMO_HOUSEHOLD_ID, expiresAt: "2026-06-01T08:00:00.000Z" }],
  failedOutboxCount: 2,
  failedWebhookCount: 0,
  billingMismatchCount: 1
};

export const demoSearchRows: SearchRow[] = [
  {
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Demo Household",
    ownerDisplayName: "Demo Owner",
    ownerPhoneMasked: "+972-50-***-1234",
    status: "trial",
    planLabel: "Trial (no pricebook plan)",
    effectiveBillingStatus: "active",
    memberCount: 5,
    lastWaActivityAt: "2026-06-22T09:30:00.000Z",
    integrityFlagCount: 1
  },
  {
    householdId: "demo-2",
    name: "Demo Family (trialing)",
    ownerDisplayName: "Demo Parent",
    ownerPhoneMasked: "+972-52-***-5678",
    status: "trial",
    planLabel: "Trial (no pricebook plan)",
    effectiveBillingStatus: "trialing",
    memberCount: 3,
    lastWaActivityAt: "2026-06-21T17:05:00.000Z",
    integrityFlagCount: 0
  }
];

export const demoHousehold360: Household360 = {
  household: { id: DEMO_HOUSEHOLD_ID, name: "Demo Household", status: "trial", ownerUserId: "demo-owner-user", createdAt: "2026-05-01T10:00:00.000Z" },
  owner: { id: "demo-owner-user", displayName: "Demo Owner", phoneMasked: "+972-50-***-1234" },
  members: [
    { memberId: "m-owner", userId: "demo-owner-user", displayName: "Demo Owner (בעל הבית)", phoneMasked: "+972-50-***-1234", role: "owner", status: "active", isOwner: true, isCoManager: false, joinedAt: "2026-05-01T10:00:00.000Z", lastWaInboundAt: "2026-06-22T09:30:00.000Z", lastWaOutboundAt: "2026-06-22T09:31:00.000Z", dashboardLastSeenAt: "2026-06-22T20:00:00.000Z", onboardingStuck: false },
    { memberId: "m-admin", userId: "demo-admin", displayName: "Demo Admin (מנהל)", phoneMasked: "+972-54-***-2222", role: "admin", status: "active", isOwner: false, isCoManager: false, joinedAt: "2026-05-02T08:00:00.000Z", lastWaInboundAt: "2026-06-20T12:00:00.000Z", dashboardLastSeenAt: "2026-06-21T19:00:00.000Z", onboardingStuck: false },
    { memberId: "m-comgr", userId: "demo-comanager", displayName: "Demo Co-manager (מנהל שותף)", phoneMasked: "+972-52-***-6666", role: "adult_member", status: "active", isOwner: false, isCoManager: true, joinedAt: "2026-05-02T09:00:00.000Z", lastWaInboundAt: "2026-06-20T13:00:00.000Z", dashboardLastSeenAt: "2026-06-21T20:00:00.000Z", onboardingStuck: false },
    { memberId: "m-adult", userId: "demo-adult", displayName: "Demo Adult (מבוגר)", phoneMasked: "+972-53-***-3333", role: "adult_member", status: "active", isOwner: false, isCoManager: false, joinedAt: "2026-05-03T08:00:00.000Z", lastWaInboundAt: "2026-06-19T10:00:00.000Z", onboardingStuck: false },
    { memberId: "m-kid", userId: "demo-limited", displayName: "Demo Teen (בן/בת בית)", phoneMasked: "+972-55-***-4444", role: "limited_member", status: "active", isOwner: false, isCoManager: false, joinedAt: "2026-05-10T08:00:00.000Z", onboardingStuck: false },
    { memberId: "m-removed", userId: "demo-removed", displayName: "Demo Left Member", phoneMasked: "+972-58-***-7777", role: "adult_member", status: "removed", isOwner: false, isCoManager: false, joinedAt: "2026-05-04T08:00:00.000Z", onboardingStuck: false }
  ],
  invites: [
    { id: "inv-pending", invitedPhoneMasked: "+972-53-***-9999", invitedName: "Pending Teen", role: "limited_member", expiresAt: "2099-01-01T00:00:00.000Z", state: "pending" },
    { id: "inv-expired", invitedPhoneMasked: "+972-50-***-8888", invitedName: "Old Invite", role: "adult_member", expiresAt: "2026-06-01T00:00:00.000Z", state: "expired" }
  ],
  billing: {
    rawStatus: "active",
    effectiveStatus: "active",
    planLabel: "Trial (no pricebook plan)",
    planCode: "trial",
    provider: "manual",
    isManualGrant: true,
    isPaid: false,
    trialEndsAt: undefined,
    trialDaysRemaining: null,
    currentPeriodEnd: "2099-01-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    usageMeters: [
      { id: "ent-1", householdId: DEMO_HOUSEHOLD_ID, featureCode: "receipt_scans_total", limitType: "total_count", limitValue: 5, usedValue: 2, periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-21T00:00:00.000Z" }
    ],
    events: [
      { id: "ev-grant", eventType: "manual_grant", reason: "goodwill — onboarding hiccup (demo)", adminSubject: "admin@demo.example", grantKind: "free_month", correlationId: "demo-corr-1", startsAt: "2026-06-15T08:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-06-15T08:00:00.000Z" }
    ]
  },
  counts: { members: 6, activeMembers: 5, purchases: 128, receipts: 34, shoppingItems: 212 },
  ops: { failedWaMessageCount: 1, staleInviteCount: 1, pendingInviteCount: 1 },
  integrityFlags: ["stale_invites"]
};

export const demoAudit: AuditEntry[] = [
  { id: "au-1", action: "admin.phone.revealed", createdAt: "2026-06-22T10:00:00.000Z", adminSubject: "admin@demo.example", reason: "support case 1234", metadata: {} },
  { id: "au-2", action: "admin.billing.grant.created", createdAt: "2026-06-15T08:00:00.000Z", adminSubject: "admin@demo.example", reason: "goodwill — onboarding hiccup (demo)", metadata: {} },
  { id: "au-3", action: "admin.household.viewed", createdAt: "2026-06-22T09:59:00.000Z", adminSubject: "admin@demo.example", metadata: {} }
];

export const demoNotes: SupportNote[] = [
  { id: "n-1", householdId: DEMO_HOUSEHOLD_ID, adminSubject: "admin@demo.example", body: "Customer called about a trial extension — granted a free month.", createdAt: "2026-06-15T08:05:00.000Z" }
];

// Advanced "operational feeds". Messages carry NO body (metadata only) — consistent
// with the no-WhatsApp-content rule.
export const demoOverview: Overview = {
  households: [],
  receipts: [
    { id: "r-1", householdId: DEMO_HOUSEHOLD_ID, uploadedByUserId: "demo-owner-user", status: "parsed", merchantName: "Demo Supermarket", totalAmount: 89.9, confidenceScore: 0.93, createdAt: "2026-06-22T08:00:00.000Z", updatedAt: "2026-06-22T08:01:00.000Z" }
  ],
  messages: [
    { id: "msg-1", userId: "demo-owner-user", householdId: DEMO_HOUSEHOLD_ID, direction: "inbound", messageType: "text", intent: "add_expense", processingStatus: "processed", createdAt: "2026-06-22T09:30:00.000Z" },
    { id: "msg-2", userId: "demo-owner-user", householdId: DEMO_HOUSEHOLD_ID, direction: "outbound", messageType: "text", processingStatus: "processed", createdAt: "2026-06-22T09:31:00.000Z" }
  ],
  outbox: [
    { id: "ob-1", channel: "whatsapp", destinationMasked: "+972-50-***-1234", status: "sent", deliveryStatus: "delivered", kind: "receipt_proposal", idempotencyKey: "demo-idem-1", retryCount: 0, nextAttemptAt: "2026-06-22T09:31:00.000Z", createdAt: "2026-06-22T09:31:00.000Z", updatedAt: "2026-06-22T09:32:00.000Z" },
    { id: "ob-2", channel: "whatsapp", destinationMasked: "+972-52-***-5678", status: "failed", kind: "invite", idempotencyKey: "demo-idem-2", retryCount: 2, nextAttemptAt: "2026-06-22T10:00:00.000Z", deliveryErrorCode: "131047", createdAt: "2026-06-22T09:00:00.000Z", updatedAt: "2026-06-22T09:30:00.000Z" }
  ],
  webhookEvents: [
    { id: "wh-1", provider: "meta_whatsapp", eventType: "messages", status: "processed", createdAt: "2026-06-22T09:30:00.000Z" }
  ],
  entitlements: [
    { id: "ent-1", householdId: DEMO_HOUSEHOLD_ID, featureCode: "receipt_scans_total", limitType: "total_count", limitValue: 5, usedValue: 2, periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-21T00:00:00.000Z" }
  ],
  analyticsEvents: [
    { id: "an-1", name: "receipt_uploaded", householdId: DEMO_HOUSEHOLD_ID, userId: "demo-owner-user", createdAt: "2026-06-22T08:00:00.000Z" }
  ],
  providerLogs: [
    { id: "pl-1", provider: "meta_whatsapp", direction: "outbound", eventType: "send", status: "success", correlationIdMasked: "wamid.…AB12", metadata: { deliveryStatus: "delivered" }, createdAt: "2026-06-22T09:31:00.000Z" }
  ],
  supportNotes: [
    { id: "n-1", householdId: DEMO_HOUSEHOLD_ID, adminSubject: "admin@demo.example", body: "Customer called about a trial extension — granted a free month.", createdAt: "2026-06-15T08:05:00.000Z" }
  ],
  auditLogs: [
    { id: "au-1", action: "admin.phone.revealed", entityType: "household_member", entityId: "m-owner", adminSubject: "admin@demo.example", reason: "support case 1234", createdAt: "2026-06-22T10:00:00.000Z" }
  ]
};
