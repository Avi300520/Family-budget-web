import type { Metadata } from "next";
import { MarketingLanding } from "../../components/marketing/MarketingLanding";
import { SessionRedirect } from "../../components/auth/SessionRedirect";

// /login stays a valid entry point and renders the SAME marketing landing as /.
// This preserves the auth-guard contract exactly: redirectIfUnauthorized() sends
// unauthenticated users to /login?next=<path>, and the hero magic-link form reads
// ?next= from window.location.search at submit time. Canonical -> / so the two
// URLs don't split SEO; /login is excluded from the sitemap.
export const metadata: Metadata = {
  title: "כניסה | Pingtally",
  alternates: { canonical: "/" },
};

export default function LoginPage() {
  return (
    <>
      <SessionRedirect />
      <MarketingLanding />
    </>
  );
}
