import type { NextConfig } from "next";

/**
 * Baseline (non-strict) CSP + security headers. Sufficient for an internal
 * fleet tool: blocks injected external scripts/styles, clickjacking, and
 * cloudflare-style origin leaks, while leaving room for Next/Turbopack's
 * inline bootstrapping. Upgrade path: strict CSP with per-request nonces
 * generated in `proxy.ts` (see docs/app/api-reference/file-conventions/proxy).
 */
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=()",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss: ws:",
      "media-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "better-auth",
  ],
  /**
   * CORS policy: same-origin only. Every client (dashboard, driver PWA, portal
   * page) lives on this origin, so we deliberately send NO
   * Access-Control-Allow-Origin header - browsers enforce the same-origin
   * policy. If an external client ever needs the API, add an explicit allowlist
   * (reflect an allowed origin in headers(), never `*` with cookies).
   */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;