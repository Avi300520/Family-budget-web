import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/siteUrl";

// Only public, indexable pages. /login is intentionally excluded (it renders the
// same content as / and canonicals to /). Authenticated routes are never listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
