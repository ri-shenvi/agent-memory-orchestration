import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@memory-debugger/db", "@memory-debugger/ui"],
};

export default nextConfig;
