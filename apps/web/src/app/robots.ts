import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteUrl";

// Allow the public marketing + legal pages; disallow every authenticated app
// route (most are client-auth-gated, not noindex, so they must be blocked here).
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
        "/l",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
