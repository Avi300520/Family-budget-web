// Hebrew role labels — shared across the sidebar identity block, settings, and
// dashboard so the same role always reads the same word. (Previously inlined in
// dashboard/page.tsx.)
import type { HouseholdRole } from "@shopping-assistant/shared-types";

export const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  adult_member: "חבר מבוגר",
  limited_member: "בן/בת בית",
};

export function roleLabelFor(role: HouseholdRole | string | undefined): string {
  return ROLE_LABELS[role ?? ""] ?? "";
}
