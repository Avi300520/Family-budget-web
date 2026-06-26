import { Suspense } from "react";
import { AppShell } from "../../../components/AppShell";
import { LoadState } from "../../../components/LoadState";
import BillingClient from "../../billing/BillingClient";

// useSearchParams (the ?status=success/failed return param) must sit under a
// Suspense boundary for app-router static rendering — mirror the auth/consume page.
// This re-mounts the existing BillingClient under /settings/billing (settings hub card);
// the old /billing route is left untouched.
export default function SettingsBillingPage() {
  return (
    <Suspense fallback={<AppShell><LoadState /></AppShell>}>
      <BillingClient />
    </Suspense>
  );
}
