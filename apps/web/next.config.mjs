/** @type {import('next').NextConfig} */

// WP-SEC-02 — baseline security headers on every response of the public consumer
// site. CSP is REPORT-ONLY for now: it observes violations (nothing is blocked)
// so we can tighten it from real telemetry before switching to enforcing. The
// 'unsafe-inline'/'unsafe-eval' allowances reflect Next.js's inline hydration
// payload and next/font's injected <style> — tightening those needs nonces and is
// a follow-up done from report data, not a guess.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.pingtally.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig = {
  transpilePackages: ["@shopping-assistant/api-client", "@shopping-assistant/shared-types"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Token-scoped share links carry a bearer token and must never be indexed.
      // Deliberately kept OUT of robots.txt (see robots.ts); enforced here as a
      // response header plus the page's own robots:{index:false} metadata.
      { source: "/l/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
