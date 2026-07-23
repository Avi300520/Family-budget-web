import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteUrl";

// Allow the public marketing + legal pages; disallow every authenticated app
// route (most are client-auth-gated, not noindex, so they must be blocked here).
//
// AI-crawler policy (deliberate — WP-CRAWL-02): we keep a single permissive
// `userAgent: "*"` rule and do NOT block AI / answer-engine crawlers
// (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot, GPTBot,
// Bingbot, Google-Extended, etc.). Pingtally WANTS to be discoverable and
// citable by AI search; Bing's index also feeds ChatGPT. The only things hidden
// are authenticated app routes, which carry no marketing value.
//
// /l/[token] is intentionally NOT listed here: a robots.txt Disallow would only
// advertise the private share-link path in a world-readable file while doing
// nothing to stop indexing of an already-known URL. It is kept out of the index
// via an `X-Robots-Tag: noindex` response header (next.config.mjs) plus the
// page's own `robots: { index:false }` metadata, and excluded from sitemap.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/settings",
        "/onboarding",
        "/billing",
        "/family",
        "/receipts",
        "/shopping-list",
        "/insights",
        "/export",
        "/my-requests",
        "/join",
        "/budget",
        "/auth",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
