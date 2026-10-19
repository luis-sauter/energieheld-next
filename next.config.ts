import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public deploy origin only: Netlify's DEPLOY_URL is build-time, not a
  // guaranteed function-runtime variable. Pin bundled banner reads to this deploy.
  env: { BANNER_ASSET_ORIGIN: process.env.DEPLOY_URL ?? "" },
};

export default nextConfig;
