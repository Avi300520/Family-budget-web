// Maps a checkout failure to billing-page UI state. Import-free (duck-typed on the
// ApiClientError { code, status } shape) so it stays unit-testable with `node --test`
// (same convention as authRouting.ts / settingsView.ts).
//
// CRITICAL: only a genuine role-authz failure (billing.forbidden) may collapse the page into
// the owner-only view. billing.disabled (billing is OFF) and billing.email_required (validation)
// are NOT permission problems — they must show a clear inline message while the plan cards and
// invoice-email field stay visible. Matching on err.status===403 alone (the prior bug) wrongly
// collapsed the page whenever billing was dormant, because billing.disabled is also a 403.

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
