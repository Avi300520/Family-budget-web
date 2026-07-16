import type { Metadata } from "next";
import { ShareList } from "./ShareList";

// BATCH-BB — the no-login shopping-mode share page. A server component so it can set noindex
// (a "use client" page can't export metadata); the interactive list is the client child.
// noindex + /l in robots.ts disallow + excluded from sitemap.ts — this URL carries a bearer
// token and must never be indexed. he-only (inherits the root <html lang="he" dir="rtl">).
export const metadata: Metadata = {
  title: "רשימת קניות",
  robots: { index: false, follow: false },
};

export default async function ShareListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ShareList token={token} />;
}
