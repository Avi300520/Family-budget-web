import { redirect } from "next/navigation";

// Household search now lives on the unified Admin Dashboard. This route is kept
// only so existing deep links don't 404 — it redirects to the dashboard.
export default function HouseholdsIndexRedirect() {
  redirect("/");
}
