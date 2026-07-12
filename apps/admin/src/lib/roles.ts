// Owner-facing role display for the admin UI. This is COPY ONLY — it never changes
// internal role names, DB values, permissions, or authz. The help text is kept
// consistent with the actual backend permission model (co-manager = an adult_member
// with permissions.all; see the household-manager floor in the backend authz).

export interface RoleDisplay {
  /** Clear Hebrew label for the role. */
  label: string;
  /** Plain-language explanation (used as a tooltip / help affordance). */
  help: string;
}

/** Resolve a clear Hebrew role label + help text. `isCoManager` distinguishes an
 *  adult_member with broad management permissions; `status==='removed'` overrides. */
export function roleDisplay(role: string, opts?: { isCoManager?: boolean; status?: string }): RoleDisplay {
  if (opts?.status === "removed") {
    return { label: "חבר שהוסר", help: "היה משויך לבית בעבר ואינו פעיל כרגע." };
  }
  switch (role) {
    case "owner":
      return { label: "בעל הבית", help: "יכול לנהל את הבית, ההרשאות, ההזמנות והבילינג. אין להסיר אותו דרך משתמש אחר." };
    case "admin":
      return { label: "מנהל", help: "יכול לנהל את רוב הגדרות הבית והחברים, לפי מדיניות ההרשאות." };
    case "adult_member":
      return opts?.isCoManager
        ? { label: "מנהל שותף", help: "מבוגר עם הרשאות ניהול רחבות בבית, אך לא משנה בעלות או בילינג אם המדיניות מגבילה זאת." }
        : { label: "מבוגר", help: "חבר בית רגיל עם גישה לפי הרשאות." };
    case "limited_member":
      return { label: "בן/בת בית", help: "גישה מצומצמת. יכול להעלות קבלות לפי המדיניות, אך לא רואה נתונים רגישים או ניהול בית." };
    default:
      return { label: role, help: "" };
  }
}

/** Clear Hebrew label for a member's membership status. */
export function memberStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "פעיל";
    case "removed":
      return "חבר שהוסר";
    case "invited":
      return "הוזמן";
    default:
      return status;
  }
}

/** Clear Hebrew label for a household invite's derived state. */
export function inviteStateLabel(state: string): string {
  switch (state) {
    case "pending":
      return "הזמנה ממתינה";
    case "expired":
      return "הזמנה שפגה";
    case "consumed":
      return "הזמנה נוצלה";
    default:
      return state;
  }
}
