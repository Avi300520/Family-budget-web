import type { Metadata } from "next";
import { ShareList } from "./ShareList";

// BATCH-BB — the no-login shopping-mode share page. A server component so it can set noindex
// (a "use client" page can't export metadata); the interactive list is the client child.
// noindex + /l in robots.ts disallow + excluded from sitemap.ts — this URL carries a bearer
// token and must never be indexed. he-only (inherits the root <html lang="he" dir="rtl">).
// WP-CRAWL-01: a STATIC, token-free share card so the link unfurls in WhatsApp as
// "a shared shopping list" instead of the generic homepage. The bearer token lives
// only in the URL path and must NEVER appear in an og:/twitter: tag — keeping this
// metadata static (no access to `params.token`) structurally guarantees that.
export const metadata: Metadata = {
  title: "רשימת קניות",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Pingtally",
    title: "רשימת קניות משותפת",
    description:
      "מישהו שיתף איתך רשימת קניות ב-Pingtally. פותחים, מסמנים מה שקנו — בלי הורדה ובלי הרשמה.",
    locale: "he_IL",
    images: [{ url: "/og-pingtally-v2.png", width: 1200, height: 630, alt: "Pingtally" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "רשימת קניות משותפת",
    description: "מישהו שיתף איתך רשימת קניות ב-Pingtally. פותחים ומסמנים מה שקנו.",
    images: ["/og-pingtally-v2.png"],
  },
};

export default async function ShareListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ShareList token={token} />;
}
