import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
