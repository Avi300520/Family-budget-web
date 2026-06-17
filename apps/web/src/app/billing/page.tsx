import { Suspense } from "react";
import { AppShell } from "../../components/AppShell";
import { LoadState } from "../../components/LoadState";
import BillingClient from "./BillingClient";

// useSearchParams (the ?status=success/failed return param) must sit under a
// Suspense boundary for app-router static rendering — mirror the auth/consume page.
export default function BillingPage() {
  return (
    <Suspense fallback={<AppShell><LoadState /></AppShell>}>
      <BillingClient />
    </Suspense>
  );
}
