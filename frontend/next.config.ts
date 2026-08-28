import type { NextConfig } from "next";

/**
 * Where to forward /api/* when the browser must not reach the API directly.
 *
 * The deployed frontend is served over HTTPS and the API host offers no TLS, and
 * a browser refuses to let an HTTPS page call an HTTP endpoint - it blocks the
 * request as mixed active content before CORS is ever considered. Proxying sends
 * the browser to this origin over HTTPS and lets the server make the plain-HTTP
 * hop, which no such rule applies to.
 *
 * It also makes the API same-origin, which removes the CORS exchange entirely and
 * turns the refresh cookie back into a first-party one.
 *
 * Leave unset to have the browser call the API directly (the localhost setup).
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  // The dev tools badge defaults to bottom-left, which sits on top of the
  // sidebar account area. Move it out of the way; development only.
  devIndicators: {
    position: "bottom-right",
  },

  // Nothing is gained by announcing the framework and version to anyone
  // scanning for known issues.
  poweredByHeader: false,

  async rewrites() {
    if (!apiProxyTarget) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No screen here is meant to be embedded. Framing an admin surface
          // is only useful to somebody building a lookalike around it.
          { key: "X-Frame-Options", value: "DENY" },
          // Stop a response being re-interpreted as a type it does not claim.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // A guest QR link carries a table token in its path. Send the origin
          // only, so the token does not travel in a Referer to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
