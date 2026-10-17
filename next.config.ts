import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image (PureGaz VPS).
  output: "standalone",
};

export default nextConfig;
