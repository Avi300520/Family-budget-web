// Maps a checkout failure to billing-page UI state. Import-free (duck-typed on the
// ApiClientError { code, status } shape) so it stays unit-testable with `node --test`
// (same convention as authRouting.ts / settingsView.ts).
//
// CRITICAL: only a genuine role-authz failure (billing.forbidden) may collapse the page into
// the owner-only view. billing.disabled (billing is OFF) and billing.email_required (validation)
// are NOT permission problems — they must show a clear inline message while the plan cards and
// invoice-email field stay visible. Matching on err.status===403 alone (the prior bug) wrongly
// collapsed the page whenever billing was dormant, because billing.disabled is also a 403.

/** True if the checkout URL is a real off-site provider payment page to redirect the browser to.
 *  The mock/dev provider returns an ON-SITE /api/v1/dev/mock-checkout URL (not a payment page) — never
 *  redirect there (show the test-env message). A real HYP page is https://pay.hyp.co.il/… and MAY embed
 *  our own callback URLs as query params, so we must NOT sniff for "localhost"/"mock" substrings — that
 *  was the prior bug (the real HYP URL embeds a localhost Success param and was wrongly rejected). */
export function isRealCheckoutRedirect(url: string | undefined | null): boolean {
  return !!url && /^https?:\/\//i.test(url) && !url.includes("/dev/mock-checkout");
}

export type ReturnBanner = "active" | "processing" | "failed" | null;

/** Decide the post-checkout banner from the BACKEND subscription status (the source of truth) plus
 *  the ?status= URL hint. Incident 2026-07-03: the UI trusted ?status= alone, so an APPROVED payment
 *  that our (then-buggy) VERIFY rejected showed "failed", and a stale ?status=success could claim
 *  paid while still trial. Rules: if the backend says active -> "active" (paid), regardless of the
 *  hint; else ?status=success but not-yet-active -> "processing" (updating, refresh); else
 *  ?status=failed -> "failed"; else nothing. Never show "failed" when the subscription is active. */
export function checkoutReturnBanner(returnStatus: string | null | undefined, effectiveStatus: string | undefined): ReturnBanner {
  if (effectiveStatus === "active") return "active";
  if (returnStatus === "success") return "processing";
  if (returnStatus === "failed") return "failed";
  return null;
}

export type CheckoutErrorUi = { restricted: true } | { message: string };

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

export function classifyCheckoutError(err: unknown): CheckoutErrorUi {
  switch (errorCode(err)) {
    case "billing.forbidden":
      return { restricted: true };
    case "billing.disabled":
      return { message: "התשלום עדיין לא פעיל. נעדכן אתכם כשאפשר יהיה לשדרג." };
    case "billing.upgrade_required":
      return { message: "המסלול שנבחר לא מכסה את מספר הילדים בבית. בחרו מסלול גבוה יותר." };
    case "billing.email_required":
      return { message: "נא להזין אימייל תקין לשליחת החשבונית לפני התשלום." };
    default:
      return { message: err instanceof Error ? err.message : "לא הצלחנו לפתוח את התשלום. נסו שוב." };
  }
}
