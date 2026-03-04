import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@bithauss/types", "@bithauss/validators", "@bithauss/config"],
};

export default nextConfig;
