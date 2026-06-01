import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile elsewhere can
  // otherwise make Next infer the wrong root).
  outputFileTracingRoot: __dirname,
  images: {
    // Allow remote recipe images from any https host (scraped sources vary widely).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
