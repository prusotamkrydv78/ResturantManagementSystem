import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev tools badge defaults to bottom-left, which sits on top of the
  // sidebar account area. Move it out of the way; development only.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
