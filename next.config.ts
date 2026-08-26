import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for the multi-stage Dockerfile (`.next/standalone`).
  output: "standalone",
  experimental: {
    // Garment photos for size recognition are uploaded through a Server Action.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default withNextIntl(nextConfig);
