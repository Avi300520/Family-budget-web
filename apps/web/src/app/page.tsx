import type { Metadata } from "next";
import { MarketingLanding } from "../components/marketing/MarketingLanding";
import { SessionRedirect } from "../components/auth/SessionRedirect";

// Public marketing root. Server component: the full landing body renders as
// static HTML (crawlable, no client-render wall). Authenticated users reach the
// dashboard via the in-app "כניסה לחשבון" link and direct /dashboard navigation;
// there is intentionally NO server redirect here, so crawlers and logged-out
// users always receive the full marketing HTML.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <SessionRedirect />
      <MarketingLanding />
    </>
  );
}
