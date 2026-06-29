import { redirect } from "next/navigation";

/**
 * /family/pulse was DashboardB (member/weekday spend + activity heatmap). The
 * redesign (§I) merged it into the single "תובנות וניתוח" screen at /insights
 * (the "ניתוח" tab). This route now redirects there so old links + the removed
 * nav item never orphan the analysis charts.
 */
export default function FamilyPulseRedirect() {
  redirect("/insights");
}
