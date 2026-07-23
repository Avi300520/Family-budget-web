import type { MetadataRoute } from "next";

// The admin console is never meant to be publicly indexed — disallow everything.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
