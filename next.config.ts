import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://192.168.100.101:3000"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
