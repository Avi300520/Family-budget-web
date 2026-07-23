/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@shopping-assistant/api-client"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // WP-SEC-02 — baseline security headers. The admin console is private and
          // must NEVER be framed, so unlike the consumer site its anti-framing is
          // ENFORCING: frame-ancestors 'none' (modern) + X-Frame-Options DENY
          // (legacy fallback). No other CSP directives, so nothing else is restricted.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
