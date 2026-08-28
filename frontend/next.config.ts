import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev tools badge defaults to bottom-left, which sits on top of the
  // sidebar account area. Move it out of the way; development only.
  devIndicators: {
    position: "bottom-right",
  },

  // Nothing is gained by announcing the framework and version to anyone
  // scanning for known issues.
  poweredByHeader: false,

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
