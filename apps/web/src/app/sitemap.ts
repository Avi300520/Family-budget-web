import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteUrl";

// Only public, indexable pages. /login is intentionally excluded (it renders the
// same content as / and canonicals to /). Authenticated routes are never listed.
//
// WP-CRAWL-02: changeFrequency + priority are dropped — Google has publicly
// stated it ignores both. `lastModified` is a real signal and is the one field
// kept. Dates are stable (bumped only when the page content actually changes) so
// the sitemap doesn't churn on every deploy.
export default function sitemap(): MetadataRoute.Sitemap {
  const legalLastUpdated = new Date("2026-06-22"); // matches the "lastUpdated" on the legal pages
  return [
    { url: `${SITE_URL}/`, lastModified: new Date("2026-07-21") },
    { url: `${SITE_URL}/privacy`, lastModified: legalLastUpdated },
    { url: `${SITE_URL}/terms`, lastModified: legalLastUpdated },
  ];
}
