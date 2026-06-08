import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile elsewhere can
  // otherwise make Next infer the wrong root).
  outputFileTracingRoot: __dirname,
  images: {
    // Allow remote recipe images from any https host (scraped sources vary widely).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default withNextIntl(nextConfig);
